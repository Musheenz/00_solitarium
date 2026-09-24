@echo off
rem Double-click to test John's Solitaire on a machine without Node (uses Python).
rem Close this window to stop the server.
cd /d "%~dp0..\docs"
start "" "http://localhost:8123/"
py -m http.server 8123
