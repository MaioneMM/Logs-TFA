import io
import re
import json

log_path = r"d:\Downloads\log tfa\tasklog.log"

tests = []
current_test = None
test_lines = []

with io.open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        line = line.strip()
        if 'Logs do Sikulix - Teste:' in line:
            if current_test:
                tests.append({'name': current_test, 'lines': test_lines})
            match = re.search(r'"([^"]+)"', line)
            if match:
                current_test = match.group(1)
                test_lines = []
        elif current_test is not None:
            test_lines.append(line)
            
if current_test:
    tests.append({'name': current_test, 'lines': test_lines})

print(f"Found {len(tests)} tests.")

passing = 0
failing = 0
results = []

for t in tests:
    # Look for indications of error
    # We check if there's any '[error]' line
    has_error_tag = any('[error]' in l for l in t['lines'])
    has_exception = any('Exception' in l for l in t['lines'])
    has_traceback_error = any('TRACEBACK:' in l and 'TRACEBACK: None' not in l for l in t['lines'])
    
    # Also check for lines matching "Erro -" or "Erro(" (for semantic errors reported in the custom script)
    has_semantic_error = any('Erro -' in l or 'Erro(' in l or 'Erro (' in l for l in t['lines'])
    
    if has_error_tag or has_exception or has_traceback_error or has_semantic_error:
        failing += 1
        status = 'error'
        print(f"Failed: {t['name']}")
        err_lines = [l for l in t['lines'] if '[error]' in l or 'Exception' in l or ('TRACEBACK:' in l and 'TRACEBACK: None' not in l) or 'Erro -' in l or 'Erro(' in l or 'Erro (' in l]
        if err_lines:
            print(f"  Reason: {err_lines[0]}")
    else:
        # Wait, if there are NO [error] tags, is it passing?
        # Let's see if there is any other way to tell.
        passing += 1
        status = 'pass'
        
    results.append({'name': t['name'], 'status': status, 'logs': t['lines']})

print(f"Passing: {passing}, Failing: {failing}")

with open(r'C:\Users\maion\.gemini\antigravity\scratch\parsed_logs.json', 'w') as f:
    json.dump(results, f, indent=2)
