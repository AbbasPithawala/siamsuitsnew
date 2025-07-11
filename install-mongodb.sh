#!/bin/bash

# MongoDB Installation Script for Ubuntu/Debian
# Run this script on your Hostinger KVM2 server

echo "Installing MongoDB on KVM2 Server..."

# Update package list
sudo apt update

# Install required packages
sudo apt install -y wget curl gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release

# Import MongoDB public GPG key
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package list again
sudo apt update

# Install MongoDB
sudo apt install -y mongodb-org

# Enable and start MongoDB service
sudo systemctl enable mongod
sudo systemctl start mongod

# Check MongoDB status
sudo systemctl status mongod

echo "MongoDB installation completed!"
echo "MongoDB is running on localhost:27017"

# Optional: Create a database user (run this manually after installation)
echo ""
echo "To create a database user, run the following commands:"
echo "mongo"
echo "use admin"
echo "db.createUser({user: 'admin', pwd: 'your_password_here', roles: ['root']})"
echo "exit" 