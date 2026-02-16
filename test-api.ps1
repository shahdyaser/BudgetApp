# Test script for the process-transaction API endpoint
$url = "http://localhost:3000/api/process-transaction"
$body = @{
    message = "credit card #5233 charged EGP 150.00 at Starbucks"
} | ConvertTo-Json

Write-Host "Testing API endpoint: $url" -ForegroundColor Cyan
Write-Host "Request body:" -ForegroundColor Yellow
Write-Host $body -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody -ForegroundColor Red
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
        Write-Host "Make sure your Next.js dev server is running on port 3000" -ForegroundColor Yellow
        Write-Host "Run: npm run dev" -ForegroundColor Yellow
    }
}
