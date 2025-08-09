# Start from an official Python base image
FROM python:3.9-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code into the container
COPY . .

# Command to run the application
CMD ["python", "app.py"]