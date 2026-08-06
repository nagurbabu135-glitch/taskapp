Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\nagur\OneDrive\Documents\Default Project\taskapp\backend"
shell.Run "node ""C:\Users\nagur\OneDrive\Documents\Default Project\taskapp\backend\server.js""", 0, False
