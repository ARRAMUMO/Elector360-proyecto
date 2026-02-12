# Configuración (Mismas variables que deploy.ps1)
$EC2_IP = "3.16.128.231"
$EC2_USER = "ubuntu"
$KEY_PATH = "C:\Users\ARRAM\llave amazon.pem"

Write-Host "Verificando estado de Docker en $EC2_IP..." -ForegroundColor Cyan

# Comandos para verificar servicio y contenedores
$commands = "echo '--- ESTADO DEL SERVICIO ---' && sudo systemctl is-active docker && echo '--- CONTENEDORES ACTIVOS ---' && sudo docker ps"

# Ejecución remota
ssh -i $KEY_PATH $EC2_USER@$EC2_IP $commands

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nVerificacion completada." -ForegroundColor Green
} else {
    Write-Host "`nNo se pudo conectar o Docker no esta instalado." -ForegroundColor Red
}