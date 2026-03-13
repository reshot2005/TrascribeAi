import ast
import os

reqs = set()
for root, _, files in os.walk(r"c:\Users\surya\OneDrive\Desktop\PROJECTS\AI TRASCRIBE\backend"):
    if "venv" in root: continue
    for file in files:
        if file.endswith(".py"):
            with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                try:
                    tree = ast.parse(f.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                reqs.add(alias.name.split('.')[0])
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                reqs.add(node.module.split('.')[0])
                except:
                    pass

print(list(reqs))
