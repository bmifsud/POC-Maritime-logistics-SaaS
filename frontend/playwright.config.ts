import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:10000,expect:{timeout:3000},workers:1,
 reporter:[['list'],['json',{outputFile:'../artifacts/frontend-test-results.json'}]],
 use:{baseURL:'http://127.0.0.1:4180',viewport:{width:1280,height:910},headless:true,
 launchOptions:{args:['--no-sandbox']},screenshot:'only-on-failure'},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4180 --strictPort',url:'http://127.0.0.1:4180',reuseExistingServer:false}});
