import re
import os
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def check_duplicate_html_ids():
    print("=== 1. Checking Duplicate IDs in Templates ===")
    template_files = [
        "templates/index.html",
        "templates/admin.html",
        "templates/terms.html"
    ]
    for tf in template_files:
        if not os.path.exists(tf):
            continue
        with open(tf, "r", encoding="utf-8") as f:
            content = f.read()
        ids = re.findall(r'id=["\']([^"\']+)["\']', content)
        counts = Counter(ids)
        dups = {k: v for k, v in counts.items() if v > 1}
        if dups:
            print(f"  ⚠️ Duplicate IDs in {tf}: {dups}")
        else:
            print(f"  ✅ {tf}: No duplicate IDs found (Total {len(ids)} unique IDs)")

def check_duplicate_endpoints_in_app():
    print("\n=== 2. Checking FastAPI Routes in app.py ===")
    with open("app.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    route_pattern = re.compile(r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']')
    matches = route_pattern.findall(content)
    routes = [f"{method.upper()} {path}" for method, path in matches]
    counts = Counter(routes)
    dups = {k: v for k, v in counts.items() if v > 1}
    if dups:
        print(f"  ⚠️ Duplicate Routes found in app.py: {dups}")
    else:
        print(f"  ✅ app.py: Zero duplicate routes ({len(routes)} unique routes verified)")

def check_script_duplicate_declarations():
    print("\n=== 3. Checking JavaScript Declarations & Listeners ===")
    with open("static/script.js", "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    fn_pattern = re.compile(r'^\s*function\s+([a-zA-Z0-9_$]+)\s*\(')
    window_fn_pattern = re.compile(r'^\s*window\.([a-zA-Z0-9_$]+)\s*=')
    const_let_pattern = re.compile(r'^\s*(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=')
    
    functions = []
    variables = []
    
    for idx, line in enumerate(lines, 1):
        m_fn = fn_pattern.match(line)
        if m_fn:
            functions.append((m_fn.group(1), idx))
        m_wfn = window_fn_pattern.match(line)
        if m_wfn:
            functions.append((m_wfn.group(1), idx))
        m_v = const_let_pattern.match(line)
        if m_v:
            variables.append((m_v.group(1), idx))
            
    fn_counts = Counter([fn[0] for fn in functions])
    fn_dups = {k: v for k, v in fn_counts.items() if v > 1}
    if fn_dups:
        print(f"  ⚠️ Duplicate functions in script.js: {fn_dups}")
        for name in fn_dups:
            locs = [f"line {idx}" for fn, idx in functions if fn == name]
            print(f"     - {name} declared at: {', '.join(locs)}")
    else:
        print(f"  ✅ script.js: No duplicate function declarations found ({len(functions)} functions)")

    var_counts = Counter([v[0] for v in variables])
    var_dups = {k: v for k, v in var_counts.items() if v > 1}
    if var_dups:
        print(f"  ⚠️ Duplicate top-level variables in script.js: {list(var_dups.keys())[:10]}")
    else:
        print(f"  ✅ script.js: No duplicate top-level variables found")

def check_python_duplicate_functions():
    print("\n=== 4. Checking Python Function Names in app.py ===")
    with open("app.py", "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    def_pattern = re.compile(r'^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(')
    py_funcs = []
    for idx, line in enumerate(lines, 1):
        m = def_pattern.match(line)
        if m:
            py_funcs.append((m.group(1), idx))
            
    func_counts = Counter([pf[0] for pf in py_funcs])
    py_dups = {k: v for k, v in func_counts.items() if v > 1}
    if py_dups:
        print(f"  ⚠️ Duplicate functions in app.py: {py_dups}")
        for name in py_dups:
            locs = [f"line {idx}" for fn, idx in py_funcs if fn == name]
            print(f"     - {name} defined at: {', '.join(locs)}")
    else:
        print(f"  ✅ app.py: Zero duplicate function definitions ({len(py_funcs)} functions)")

if __name__ == "__main__":
    check_duplicate_html_ids()
    check_duplicate_endpoints_in_app()
    check_script_duplicate_declarations()
    check_python_duplicate_functions()
