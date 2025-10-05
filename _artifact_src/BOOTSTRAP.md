Local VPS bootstrap steps (manual):

1) Install Node.js 20 and PM2 (if not already)
   - curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   - sudo apt-get install -y nodejs
   - sudo npm i -g pm2

2) Backend API
   - cd server
   - npm install --omit=dev
   - Create .env file:
       NODE_ENV=production
       PORT=4000
       DATABASE_URL=postgres://user:pass@host:5432/db
       JWT_SECRET=please-change-me
       THUMUN_DATA_PATH=$(pwd)/data/quran-thumun-data.json
   - node src/db/migrate.js
   - pm2 start src/index.js --name halaqa-api --update-env --cwd $(pwd)
   - curl -sS http://localhost:4000/health

3) Frontend (static preview server)
   - cd ../quran-tester-app
   - npm install
   - VITE_API_URL=http://localhost:4000 npm run build
   - npx serve -s dist -l 8080   # or: pm2 start npx --name halaqa-front -- serve -s dist -l 8080
   - Open http://localhost:8080

Notes:
- Backend loads thumun data from THUMUN_DATA_PATH, already included under server/data.
- To stop: pm2 stop halaqa-api; pm2 delete halaqa-api; (same for halaqa-front if used)
