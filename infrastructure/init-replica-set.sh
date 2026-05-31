#!/bin/bash
# MongoDB Replica Set Initialization Script

set -e

echo "Waiting for MongoDB nodes to be ready..."
sleep 10

echo "Initializing MongoDB replica set..."

mongosh --host mongodb-primary:27017 -u "${MONGO_ROOT_USERNAME:-admin}" -p "${MONGO_ROOT_PASSWORD:-password}" --authenticationDatabase admin <<EOF
rs.initiate({
  _id: "cryptons-rs",
  members: [
    { _id: 0, host: "mongodb-primary:27017", priority: 2 },
    { _id: 1, host: "mongodb-secondary1:27017", priority: 1 },
    { _id: 2, host: "mongodb-secondary2:27017", priority: 1 }
  ]
});

// Wait for replica set to be initialized
sleep(5000);

// Print replica set status
rs.status();

// Create database and initial user
use cryptons;
db.createUser({
  user: "${MONGO_APP_USERNAME:-cryptons}",
  pwd: "${MONGO_APP_PASSWORD:-cryptonspass}",
  roles: [
    { role: "readWrite", db: "cryptons" },
    { role: "dbAdmin", db: "cryptons" }
  ]
});

print("MongoDB replica set initialized successfully!");
EOF

echo "Replica set initialization complete!"
