FROM python:3.11-slim

WORKDIR /app

# Instalează dependențele
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiază codul
COPY . .

# Expune portul
EXPOSE 5000

# Comandă de pornire
CMD ["python", "app.py"]