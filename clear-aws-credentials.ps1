# Clear AWS Credentials Script
# This script clears your current AWS credentials so you can login with a different account

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "    Clear AWS Credentials" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# Clear environment variables
$env:AWS_ACCESS_KEY_ID = $null
$env:AWS_SECRET_ACCESS_KEY = $null
$env:AWS_SESSION_TOKEN = $null
$env:AWS_DEFAULT_REGION = $null

Write-Host " AWS credentials cleared from current session!" -ForegroundColor Green
Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To login with a different account, run:" -ForegroundColor Yellow
Write-Host "  .\setup-aws-credentials.ps1" -ForegroundColor White
Write-Host ""
