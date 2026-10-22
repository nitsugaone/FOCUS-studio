import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./specs',
 fullyParallel:true,
 workers:2,
 retries:process.env.CI?1:0,
 timeout:45000,
 globalTimeout:10*60*1000,
 expect:{timeout:10000},
 outputDir:'./test-results',
 reporter:[['list'],['html',{outputFolder:'./playwright-report',open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4173/FOCUS-studio/',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node ../../scripts/serve-tests.mjs',url:'http://127.0.0.1:4173/FOCUS-studio/',reuseExistingServer:false,timeout:15000},
 projects:[
  {name:'chromium-small',use:{browserName:'chromium',viewport:{width:320,height:568},isMobile:true,hasTouch:true}},
  {name:'chromium-mobile',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  {name:'chromium-tablet',use:{browserName:'chromium',viewport:{width:768,height:1024},isMobile:true,hasTouch:true}},
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
  {name:'webkit-mobile',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  {name:'webkit-desktop',use:{browserName:'webkit',viewport:{width:1440,height:900}}}
 ]
});
