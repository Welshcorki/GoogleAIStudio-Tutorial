@echo off
chcp 65001 > nul
echo ========================================================
echo   AI 유튜브 검색기 (TubeFinder AI) 웹서비스 시작...
echo   URL: http://localhost:8001
echo ========================================================
C:\Users\butte\miniconda3\envs\myenv\python.exe server.py
pause
