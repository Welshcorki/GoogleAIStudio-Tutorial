@echo off
chcp 65001 > nul
echo ========================================================
echo   YouTube Audio Transcriber Web Service Starting...
echo   URL: http://localhost:8000
echo ========================================================
C:\Users\butte\miniconda3\envs\myenv\python.exe server.py
pause
