"""
Kira 2.2 - Executive Offline Vault & Mobile PWA Sync Test Suite
Verifies offline-first data structures, bidirectional synchronization,
cold backup export/import, pin/unpin controls, and PWA service worker contracts.
"""

import sys
import os
import json
import asyncio
import unittest
import time

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import vault_sync
from vault_sync import (
    init_vault_tables,
    list_vault_items,
    save_vault_item,
    delete_vault_item,
    toggle_pin_vault_item,
    bidirectional_sync,
    export_vault_backup,
    import_vault_backup,
    VaultItemSaveRequest,
    VaultBulkSyncRequest,
    VaultImportRequest
)

class TestExecutiveVaultSyncSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_vault_tables()
        cls.test_user = "test_executive_boss"

    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def tearDown(self):
        self.loop.close()

    def test_1_init_and_empty_list(self):
        """1. ตรวจสอบการเริ่มต้นตาราง SQLite และดึงข้อมูลเริ่มต้น"""
        print("\n[1/7] Testing Vault DB Init & Empty Query...")
        res = self.loop.run_until_complete(list_vault_items(username=self.test_user))
        self.assertEqual(res["status"], "success")
        self.assertIsInstance(res["items"], list)
        print("  - Table executive_vault_items initialized and queryable.")

    def test_2_save_and_pin_item(self):
        """2. ตรวจสอบการบันทึกเอกสารเดี่ยวและการปักหมุด (Pin/Unpin)"""
        print("\n[2/7] Testing Single Item Save & Pin Toggle...")
        item_id = f"test_vlt_{int(time.time())}_alpha"
        req = VaultItemSaveRequest(
            item_id=item_id,
            username=self.test_user,
            category="directive",
            title="แผนยุทธศาสตร์ AI Autonomous Q4",
            content="เป้าหมาย: ขยายการเชื่อมโยงระบบ Local-First และ MCP Hub",
            metadata={"priority": "high", "department": "Executive Board"},
            is_pinned=False
        )
        save_res = self.loop.run_until_complete(save_vault_item(req))
        self.assertEqual(save_res["status"], "success")
        self.assertEqual(save_res["action"], "created")
        self.assertEqual(save_res["item_id"], item_id)
        print("  - Created vault item successfully.")

        # Toggle Pin
        pin_res = self.loop.run_until_complete(toggle_pin_vault_item(item_id))
        self.assertEqual(pin_res["status"], "success")
        self.assertTrue(pin_res["is_pinned"])
        print("  - Pinned vault item to top priority.")

        # Toggle Pin again (Unpin)
        unpin_res = self.loop.run_until_complete(toggle_pin_vault_item(item_id))
        self.assertEqual(unpin_res["status"], "success")
        self.assertFalse(unpin_res["is_pinned"])
        print("  - Unpinned vault item.")

        # Clean up
        self.loop.run_until_complete(delete_vault_item(item_id, username=self.test_user))

    def test_3_bidirectional_sync_engine(self):
        """3. ตรวจสอบระบบซิงก์สองทิศทาง (Bidirectional Bulk Sync)"""
        print("\n[3/7] Testing Bidirectional Sync Engine (Offline Outbox -> Cloud)...")
        item1_id = f"test_sync_{int(time.time())}_1"
        item2_id = f"test_sync_{int(time.time())}_2"
        now_iso = time.strftime("%Y-%m-%d %H:%M:%S")

        outbox_changes = [
            {
                "action": "upsert",
                "item_id": item1_id,
                "title": "มติสภา 4 บริหาร: จัดตั้งศูนย์วิจัย AI ประจำไตรมาส",
                "content": "สรุปผลการอภิปรายและคำชี้ขาดของท่านประธาน",
                "category": "boardroom_minutes",
                "metadata": {"votes": 4, "consensus": True},
                "is_pinned": True,
                "client_updated_at": now_iso,
                "created_at": now_iso
            },
            {
                "action": "upsert",
                "item_id": item2_id,
                "title": "ชุดสไลด์บรรยายผู้ถือหุ้น 16:9",
                "content": "# Slide 1: Executive Vision\n- Local-First Architecture",
                "category": "slide_deck",
                "metadata": {"slides_count": 8},
                "is_pinned": False,
                "client_updated_at": now_iso,
                "created_at": now_iso
            }
        ]

        sync_req = VaultBulkSyncRequest(
            username=self.test_user,
            client_changes=outbox_changes,
            last_sync_time=None
        )

        sync_res = self.loop.run_until_complete(bidirectional_sync(sync_req))
        self.assertEqual(sync_res["status"], "success")
        self.assertEqual(sync_res["applied_count"], 2)
        self.assertGreaterEqual(len(sync_res["server_items"]), 2)
        print("  - Successfully synced 2 outbox items to server.")

        # Test Delta Sync with Delete
        delete_outbox = [
            {
                "action": "delete",
                "item_id": item2_id
            }
        ]
        delta_req = VaultBulkSyncRequest(
            username=self.test_user,
            client_changes=delete_outbox,
            last_sync_time=sync_res["synced_at"]
        )
        delta_res = self.loop.run_until_complete(bidirectional_sync(delta_req))
        self.assertEqual(delta_res["status"], "success")
        self.assertEqual(delta_res["deleted_count"], 1)
        print("  - Successfully processed offline delete action.")

        # Cleanup remaining item
        self.loop.run_until_complete(delete_vault_item(item1_id, username=self.test_user))

    def test_4_export_and_import_backup(self):
        """4. ตรวจสอบการ Cold Storage Export และ Import Backup JSON"""
        print("\n[4/7] Testing Cold Storage Export & Import JSON Backup...")
        temp_id = f"test_exp_{int(time.time())}"
        save_req = VaultItemSaveRequest(
            item_id=temp_id,
            username=self.test_user,
            category="task",
            title="Cold Storage Backup Candidate",
            content="Payload for backup serialization testing",
            metadata={"secret_level": "top-secret"},
            is_pinned=True
        )
        self.loop.run_until_complete(save_vault_item(save_req))

        # Export
        export_res = self.loop.run_until_complete(export_vault_backup(username=self.test_user))
        self.assertEqual(export_res.status_code, 200)
        export_data = json.loads(export_res.body.decode('utf-8'))
        self.assertEqual(export_data["system"], "Kira AI Executive Offline Vault")
        self.assertGreaterEqual(export_data["total_items"], 1)
        found = any(i["item_id"] == temp_id for i in export_data["items"])
        self.assertTrue(found)
        print("  - Exported JSON cold backup successfully.")

        # Delete from DB
        self.loop.run_until_complete(delete_vault_item(temp_id, username=self.test_user))

        # Import Backup
        import_req = VaultImportRequest(
            username=self.test_user,
            backup_data=export_data["items"]
        )
        import_res = self.loop.run_until_complete(import_vault_backup(import_req))
        self.assertEqual(import_res["status"], "success")
        self.assertGreaterEqual(import_res["imported_count"], 1)
        print("  - Restored vault database from backup JSON.")

        # Cleanup
        self.loop.run_until_complete(delete_vault_item(temp_id, username=self.test_user))

    def test_5_pwa_manifest_shortcuts(self):
        """5. ตรวจสอบ PWA manifest.json มี Shortcuts สำหรับ Offline Vault & Boardroom"""
        print("\n[5/7] Testing PWA manifest.json Shortcuts Contract...")
        manifest_path = os.path.join(os.path.dirname(__file__), "static", "manifest.json")
        self.assertTrue(os.path.exists(manifest_path))

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest_data = json.load(f)

        self.assertIn("shortcuts", manifest_data)
        shortcuts = manifest_data["shortcuts"]
        shortcut_names = [s.get("name") for s in shortcuts]
        self.assertTrue(any("Offline Vault" in name for name in shortcut_names))
        self.assertTrue(any("Boardroom" in name for name in shortcut_names))
        print("  - Manifest shortcuts present and valid.")

    def test_6_service_worker_sync_listener(self):
        """6. ตรวจสอบ static/sw.js มี Background Sync listener และ Cache Name v2.3"""
        print("\n[6/7] Testing Service Worker Background Sync & Cache Setup...")
        sw_path = os.path.join(os.path.dirname(__file__), "static", "sw.js")
        self.assertTrue(os.path.exists(sw_path))

        with open(sw_path, "r", encoding="utf-8") as f:
            sw_code = f.read()

        self.assertIn("kira-vault-sync", sw_code)
        self.assertIn("kira-ai-cache-v2.3", sw_code)
        self.assertIn("self.addEventListener('sync'", sw_code)
        print("  - Service Worker background sync listener & cache v2.3 verified.")

    def test_7_frontend_controller_integration(self):
        """7. ตรวจสอบการผูก initOfflineVaultController ใน static/script.js และ DOM Markup"""
        print("\n[7/7] Testing Frontend Script & Template Integration...")
        script_path = os.path.join(os.path.dirname(__file__), "static", "script.js")
        index_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")

        with open(script_path, "r", encoding="utf-8") as f:
            js_code = f.read()

        self.assertIn("function initOfflineVaultController()", js_code)
        self.assertIn("initOfflineVaultController();", js_code)
        self.assertIn("saveToOfflineVault", js_code)
        self.assertIn("openOfflineVaultModal", js_code)

        with open(index_path, "r", encoding="utf-8") as f:
            html_code = f.read()

        self.assertIn('id="offline-vault-modal"', html_code)
        self.assertIn('id="btn-vault-network-pill"', html_code)
        self.assertIn('id="vault-items-container"', html_code)
        self.assertIn('id="vault-doc-viewer"', html_code)
        print("  - Frontend controllers and HTML elements wired completely.")

if __name__ == "__main__":
    unittest.main()
