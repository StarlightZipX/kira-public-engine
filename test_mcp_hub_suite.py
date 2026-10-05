"""
Test Suite for Model Context Protocol (MCP) Hub & Tool Studio (Kira 2.2 Phase 2)
"""

import sys
import os
import json
from fastapi.testclient import TestClient

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from mcp_hub import (
    init_mcp_tables,
    auto_detect_and_dispatch_mcp,
    _tool_financial_calculator,
    _tool_workspace_inspector,
    _tool_system_diagnostics,
    _tool_market_intel,
    BUILTIN_MCP_TOOLS
)

client = TestClient(app)

def test_1_builtin_tools_direct_execution():
    print("\n[1/6] Testing Built-in MCP Tools Direct Handlers...", flush=True)
    
    # 1.1 Financial BEP
    bep_res = _tool_financial_calculator({"action": "bep", "fixed_cost": 100000, "price_per_unit": 500, "variable_cost_per_unit": 200})
    assert bep_res["bep_units_needed"] == 334
    assert bep_res["contribution_margin"] == 300
    assert "executive_verdict" in bep_res
    print("  ✅ BEP calculation passed: 334 units needed", flush=True)
    
    # 1.2 Financial ROI
    roi_res = _tool_financial_calculator({"action": "roi", "gain": 300000, "cost": 150000})
    assert roi_res["roi_percent"] == 100.0
    assert roi_res["net_profit"] == 150000
    print("  ✅ ROI calculation passed: 100.0% ROI", flush=True)
    
    # 1.3 Financial Runway
    runway_res = _tool_financial_calculator({"action": "runway", "cash": 1200000, "burn_rate": 200000, "monthly_revenue": 50000})
    assert runway_res["runway_months"] == 8.0
    print("  ✅ Runway calculation passed: 8.0 months", flush=True)
    
    # 1.4 Workspace Inspector
    ws_res = _tool_workspace_inspector({"max_depth": 2})
    assert ws_res["status"] == "success"
    assert ws_res["total_files"] > 0
    assert "file_extensions" in ws_res
    print(f"  ✅ Workspace inspection passed: {ws_res['total_files']} files scanned safely", flush=True)
    
    # 1.5 System Diagnostics
    diag_res = _tool_system_diagnostics({"check_disk": True, "check_db": True})
    assert diag_res["status"] == "HEALTHY"
    assert "os_platform" in diag_res
    assert "SQLite" in diag_res["database"]["type"]
    print("  ✅ System diagnostics passed: SQLite WAL & System Healthy", flush=True)

def test_2_autonomous_mcp_dispatcher():
    print("\n[2/6] Testing Autonomous Dispatcher Pattern Matching...", flush=True)
    
    # Financial BEP trigger
    res_bep = auto_detect_and_dispatch_mcp("ช่วยคำนวณจุดคุ้มทุน ต้นทุน 50000 ขาย 1000 ผันแปร 500 ให้หน่อย")
    assert res_bep is not None
    assert res_bep["tool_name"] == "financial_calculator"
    assert res_bep["result"]["bep_units_needed"] == 100
    print("  ✅ Auto-dispatched BEP request with extracted parameters", flush=True)
    
    # Diagnostics trigger
    res_diag = auto_detect_and_dispatch_mcp("คิระ ช่วยตรวจสุขภาพระบบและ SQLite หน่อย")
    assert res_diag is not None
    assert res_diag["tool_name"] == "system_diagnostics"
    print("  ✅ Auto-dispatched system diagnostics trigger", flush=True)
    
    # Non-MCP generic message
    res_none = auto_detect_and_dispatch_mcp("สวัสดีจ้าคิระ วันนี้อากาศดีจัง")
    assert res_none is None
    print("  ✅ Cleanly ignored non-MCP conversational query", flush=True)

def test_3_api_list_mcp_servers():
    print("\n[3/6] Testing GET /api/mcp/servers...", flush=True)
    r = client.get("/api/mcp/servers")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert data["count"] >= 3
    server_ids = [s["server_id"] for s in data["servers"]]
    assert "mcp_builtin_financial" in server_ids
    assert "mcp_builtin_workspace" in server_ids
    print(f"  ✅ MCP Servers listed successfully: {data['count']} active servers", flush=True)

def test_4_api_list_mcp_tools():
    print("\n[4/6] Testing GET /api/mcp/tools...", flush=True)
    r = client.get("/api/mcp/tools")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert data["count"] >= 4
    tool_names = [t["tool_name"] for t in data["tools"]]
    assert "financial_calculator" in tool_names
    assert "workspace_inspector" in tool_names
    assert "system_diagnostics" in tool_names
    assert "market_intel" in tool_names
    print(f"  ✅ MCP Tools listed successfully: {data['count']} standard tools verified", flush=True)

def test_5_api_execute_mcp_tool():
    print("\n[5/6] Testing POST /api/mcp/tools/execute...", flush=True)
    payload = {
        "server_id": "mcp_builtin_financial",
        "tool_name": "financial_calculator",
        "arguments": {
            "action": "bep",
            "fixed_cost": 200000,
            "price_per_unit": 1000,
            "variable_cost_per_unit": 600
        },
        "username": "boss"
    }
    r = client.post("/api/mcp/tools/execute", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert data["tool_name"] == "financial_calculator"
    assert "execution_id" in data
    assert data["result"]["bep_units_needed"] == 500
    print(f"  ✅ Execution verified: ID {data['execution_id']} in {data['execution_time_ms']}ms", flush=True)

def test_6_api_server_registration_and_audits():
    print("\n[6/6] Testing Server Registration, Audits & Guardrails...", flush=True)
    
    # 6.1 Register Custom Server
    reg_payload = {
        "name": "Test Anthropic SSE Gateway",
        "transport": "sse",
        "endpoint": "https://mcp.kira.ai/sse",
        "auth_token": "mcp_test_token_123",
        "admin_username": "boss"
    }
    r_reg = client.post("/api/mcp/servers", json=reg_payload)
    assert r_reg.status_code == 200
    custom_server_id = r_reg.json()["server_id"]
    print(f"  ✅ Custom Server Registered: {custom_server_id}", flush=True)
    
    # 6.2 Check Audits
    r_aud = client.get("/api/mcp/audits?limit=10")
    assert r_aud.status_code == 200
    audits = r_aud.json()["audits"]
    assert len(audits) > 0
    assert any(a["tool_name"] == "financial_calculator" for a in audits)
    print(f"  ✅ Audit log verified: {len(audits)} entries persisted", flush=True)
    
    # 6.3 Prevent Deleting Built-in Core Server
    r_del_builtin = client.delete("/api/mcp/servers/mcp_builtin_financial")
    assert r_del_builtin.status_code == 400
    print("  ✅ Guardrail verified: Built-in Core MCP Server protected from deletion", flush=True)
    
    # 6.4 Delete Custom Server
    r_del = client.delete(f"/api/mcp/servers/{custom_server_id}")
    assert r_del.status_code == 200
    print("  ✅ Custom Server successfully deleted", flush=True)

if __name__ == "__main__":
    print("🔌 Starting Kira 2.2 Phase 2 MCP Hub Test Suite...", flush=True)
    test_1_builtin_tools_direct_execution()
    test_2_autonomous_mcp_dispatcher()
    test_3_api_list_mcp_servers()
    test_4_api_list_mcp_tools()
    test_5_api_execute_mcp_tool()
    test_6_api_server_registration_and_audits()
    print("\n🎉 ALL MCP HUB TESTS PASSED (100% SUCCESS)!", flush=True)
