# Deploy Elector360 a EC2
# Uso: .\deploy.ps1

$EC2_IP = "3.16.128.231"
$EC2_USER = "ubuntu"
$KEY_PATH = "C:\Users\ARRAM\llave\llave amazon.pem"
$PROJECT_DIR = "/home/ubuntu/Elector360-proyecto"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY ELECTOR360 -> EC2 ($EC2_IP)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Push local a GitHub
Write-Host "[1/3] Verificando cambios locales..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "  Hay cambios sin commitear:" -ForegroundColor Red
    git status --short
    Write-Host ""
    $respuesta = Read-Host "Deseas hacer commit y push? (s/n)"
    if ($respuesta -eq "s") {
        $mensaje = Read-Host "Mensaje del commit"
        git add -A
        git commit -m "$mensaje"
        git push origin main
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error en git push. Abortando." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Abortando deploy." -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "  No hay cambios pendientes." -ForegroundColor Green
    # Verificar si hay commits sin push
    $ahead = git rev-list --count origin/main..HEAD 2>$null
    if ($ahead -gt 0) {
        Write-Host "  Hay $ahead commit(s) sin push. Pusheando..." -ForegroundColor Yellow
        git push origin main
    }
}

# Paso 2: Deploy en EC2
Write-Host ""
Write-Host "[2/3] Desplegando en EC2..." -ForegroundColor Yellow

# Se actualizó 'docker-compose' a 'docker compose' (V2) para mayor compatibilidad
$commands = @"
cd $PROJECT_DIR && \
echo '>> Pulling latest code...' && \
git pull origin main && \
echo '>> Rebuilding containers...' && \
docker compose down && \
docker compose up -d --build && \
echo '>> Waiting for health check...' && \
sleep 10 && \
docker compose ps && \
echo '>> Checking logs...' && \
docker compose logs --tail=20 backend
"@

ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" $commands

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Error en el deploy." -ForegroundColor Red
    exit 1
}

# Paso 3: Verificar
Write-Host ""
Write-Host "[3/3] Verificando servicio..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $response = Invoke-RestMethod -Uri "http://${EC2_IP}:8080/health" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "  Health check OK" -ForegroundColor Green
} catch {
    Write-Host "  Health check fallo (puede estar iniciando aun)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETADO" -ForegroundColor Green
Write-Host "  Backend: http://${EC2_IP}:8080" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green