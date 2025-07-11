# MongoDB Migration Guide: Atlas to Local KVM2

## Overview
This guide will help you migrate from MongoDB Atlas to a local MongoDB installation on your Hostinger KVM2 server.

## Step 1: Install MongoDB on KVM2 Server

1. SSH into your Hostinger KVM2 server
2. Run the installation script: `bash install-mongodb.sh`
3. Verify installation: `sudo systemctl status mongod`

## Step 2: Configure MongoDB (Optional but Recommended)

### Enable Authentication
```bash
# Connect to MongoDB
mongo

# Switch to admin database
use admin

# Create admin user
db.createUser({
  user: "admin",
  pwd: "your_secure_password_here",
  roles: ["root"]
})

# Exit MongoDB shell
exit
```

### Configure MongoDB for Remote Access (if needed)
```bash
# Edit MongoDB configuration
sudo nano /etc/mongod.conf

# Find the bindIp line and change it to:
# bindIp: 0.0.0.0  # Allow connections from any IP
# OR
# bindIp: 127.0.0.1,your_server_ip  # Allow local and specific IP

# Restart MongoDB
sudo systemctl restart mongod
```

## Step 3: Update Application Configuration

### Create .env file in siamServer directory:
```bash
cd siamServer
nano .env
```

### Add the following content to .env:
```env
# MongoDB Configuration - Local Installation
MONGOURL=mongodb://localhost:27017/siam_database

# If you enabled authentication:
# MONGOURL=mongodb://admin:your_password_here@localhost:27017/siam_database?authSource=admin

# If accessing from external server:
# MONGOURL=mongodb://your_kvm2_ip:27017/siam_database

# Other configuration
PORT=4545
NODE_ENV=production
JWT_SECRET=your_jwt_secret_here
```

## Step 4: Update Firewall (if needed)

If your application runs on a different server than your KVM2:

```bash
# Allow MongoDB port (27017) through firewall
sudo ufw allow 27017

# Or allow from specific IP only
sudo ufw allow from your_app_server_ip to any port 27017
```

## Step 5: Data Migration

### Option 1: Export from Atlas and Import to Local

#### Export from MongoDB Atlas:
```bash
# Install MongoDB tools if not already installed
sudo apt install mongodb-database-tools

# Export from Atlas
mongodump --uri="your_atlas_connection_string" --out=atlas_backup

# Import to local MongoDB
mongorestore --host localhost:27017 --db siam_database atlas_backup/your_database_name
```

#### If you have authentication enabled:
```bash
mongorestore --host localhost:27017 --username admin --password your_password --authenticationDatabase admin --db siam_database atlas_backup/your_database_name
```

### Option 2: Direct Migration Using MongoDB Compass
1. Connect to Atlas using MongoDB Compass
2. Export collections as JSON
3. Connect to local MongoDB
4. Import the JSON files

## Step 6: Test the Migration

1. Start your application: `npm start` or `npm run dev`
2. Check the logs for successful MongoDB connection
3. Test application functionality
4. Verify data integrity

## Step 7: Update Production Deployment

Once everything is working:

1. Update your production environment variables
2. Restart your application
3. Monitor for any issues

## Connection String Examples

### Local connection (same server):
```
mongodb://localhost:27017/siam_database
```

### With authentication:
```
mongodb://admin:password@localhost:27017/siam_database?authSource=admin
```

### Remote connection (different server):
```
mongodb://your_kvm2_ip:27017/siam_database
```

### With authentication and remote access:
```
mongodb://admin:password@your_kvm2_ip:27017/siam_database?authSource=admin
```

## Troubleshooting

### Common Issues:

1. **Connection refused**: Check if MongoDB is running (`sudo systemctl status mongod`)
2. **Authentication failed**: Verify username/password and authSource
3. **Cannot connect remotely**: Check firewall and bindIp configuration
4. **Permission denied**: Ensure MongoDB has proper file permissions

### Useful Commands:
```bash
# Check MongoDB status
sudo systemctl status mongod

# View MongoDB logs
sudo journalctl -u mongod

# Restart MongoDB
sudo systemctl restart mongod

# Connect to MongoDB shell
mongo

# With authentication
mongo -u admin -p --authenticationDatabase admin
```

## Security Recommendations

1. Enable authentication for production
2. Use strong passwords
3. Limit network access with firewall rules
4. Regular backups
5. Keep MongoDB updated
6. Use SSL/TLS for remote connections (advanced)

## Performance Considerations

1. Configure appropriate memory allocation
2. Set up proper indexes
3. Monitor disk space
4. Configure log rotation
5. Optimize connection pooling in your application 