# 把已生成的 exe 装到当前用户，并加上桌面和开始菜单快捷方式。
$ErrorActionPreference = "Stop"
$Name = "合规查询工具"
$Source = Join-Path $PSScriptRoot "..\dist\ComplianceTool.exe"
if (-not (Test-Path $Source)) {
  $Source = Join-Path $PSScriptRoot "..\dist\$Name.exe"
}
if (-not (Test-Path $Source)) {
  $Source = Join-Path $PSScriptRoot "..\dist\$Name\$Name.exe"
}
if (-not (Test-Path $Source)) {
  Write-Host "没有找到 $Name.exe。请先在仓库里用 PyInstaller 生成，或从 GitHub Release 下载。"
  exit 1
}
$DestDir = Join-Path $env:LOCALAPPDATA $Name
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
Copy-Item $Source (Join-Path $DestDir "ComplianceTool.exe") -Force
$Icon = Join-Path $PSScriptRoot "app.ico"
$Wsh = New-Object -ComObject WScript.Shell
function New-Link($path) {
  $link = $Wsh.CreateShortcut($path)
  $link.TargetPath = Join-Path $DestDir "ComplianceTool.exe"
  $link.WorkingDirectory = $DestDir
  $link.Description = "本地合规查询"
  if (Test-Path $Icon) { $link.IconLocation = $Icon }
  $link.Save()
}
$Desktop = [Environment]::GetFolderPath("Desktop")
New-Link (Join-Path $Desktop "$Name.lnk")
$Start = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $Start | Out-Null
New-Link (Join-Path $Start "$Name.lnk")
Write-Host "已安装到 $DestDir"
Write-Host "桌面和开始菜单里可以找到「$Name」。数据在同目录的 data_local，更新时不会覆盖它。"
Write-Host ""
Write-Host "从报告提取关键件或材料保证书时，在本机安装："
Write-Host "  pip install pdfplumber python-docx"
Write-Host "扫描件还需要离线 OCR。任选一种："
Write-Host "  1. 安装 Tesseract，并带上 chi_sim 和 eng：https://github.com/UB-Mannheim/tesseract/wiki"
Write-Host "     然后再 pip install pytesseract pillow"
Write-Host "  2. 或只装 pip install rapidocr-onnxruntime"
Write-Host "没装 OCR 时，没有文字层的 PDF 会标成「需要识别」，不会上传文件。"
