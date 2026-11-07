/** Component integration tests: mount the App via Vite; isolate its HTTP boundary. */
import {test,expect} from '@playwright/test';
const stages=(verify:string)=>({intent:{state:'ready',subtext:'From intent.md'},plan:{state:'planned',subtext:'Design complete'},build:{state:'built',subtext:'Build successful'},verify:{state:verify,subtext:verify==='passed'?'All checks green':'Missing evidence'},release:{state:'pending',subtext:'Awaiting release'}});
const payload={repo:'bmifsud/ADLC-PORTAL',commit_sha:'abc123',synced_at:new Date().toISOString(),intent_current:true,connection:'GitHub connected',diagnostics:[],tasks:[
 {task_id:'bridge-reconnect',title:'Bridge reconnect',summary:'Re-establish lost service connection with automatic recovery.',stages:stages('passed'),required_checks:[]},
 {task_id:'backup-restore',title:'Backup restore',summary:'Restore data from encrypted backup and validate integrity.',stages:stages('blocked'),required_checks:[{check_id:'encrypted-upload',name:'Encrypted upload',description:'Upload encrypted backup to storage',status:'passed',details:'Encrypted file uploaded successfully.',log_path:'.adlc/evidence/upload.log'},{check_id:'restore-test',name:'Restore test',description:'Restore from backup and verify data',status:'missing_evidence',details:'No verification output found. Restore test did not run or did not produce expected evidence.',log_path:null}]},
 {task_id:'task-dashboard',title:'Task dashboard',summary:'Developer dashboard for autonomous task supervision.',stages:{...stages('pending'),plan:{state:'pending',subtext:'Not started'},build:{state:'pending',subtext:'Not started'},verify:{state:'pending',subtext:'Not started'},release:{state:'pending',subtext:'Not started'}},required_checks:[]}
]};
test.beforeEach(async({page})=>{await page.route('**/api/v1/portal/status',r=>r.fulfill({json:payload}));await page.goto('/');});
test('renders all five pipeline stages from the API',async({page})=>{
 const matrix=page.getByRole('region',{name:'Task progress'});
 for(const name of ['INTENT','PLAN','BUILD','VERIFY','RELEASE'])await expect(matrix.getByRole('columnheader',{name,exact:true})).toBeVisible();
 await expect(matrix.getByRole('button',{name:/Bridge reconnect/})).toBeVisible();
 await expect(page.getByText('GitHub connected',{exact:true})).toBeVisible();
 await expect(page.getByText('intent.md current',{exact:true})).toBeVisible();
});
test('selects blocked task and displays evidence with a dash for a missing log',async({page})=>{
 await page.getByRole('button',{name:/Backup restore Restore data/}).click();
 const drawer=page.getByRole('region',{name:'Evidence inspector'});
 await expect(drawer.getByRole('heading',{name:'Verification blocked',exact:true})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Inspect restore evidence'})).toBeVisible();
 await expect(drawer.getByRole('row').filter({hasText:'Encrypted upload'})).toContainText('Passed');
 const missing=drawer.getByRole('row').filter({hasText:'Restore test'});
 await expect(missing).toContainText('Missing evidence');
 await expect(missing.getByRole('cell').last()).toHaveText('—');
 await expect(missing.getByRole('button')).toHaveCount(0);
 await page.screenshot({path:'../artifacts/portal-desktop.png'});
});
test('opens plain text logs and closes with Escape',async({page})=>{
 await page.route('**/api/v1/portal/logs/encrypted-upload',r=>r.fulfill({contentType:'text/plain',body:'Sanitized execution output'}));
 await page.getByRole('button',{name:/Backup restore Restore data/}).click();
 await page.getByRole('button',{name:'Open log',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Sanitized execution output');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('retains selected task while refresh updates evidence',async({page})=>{
 await page.getByRole('button',{name:/Backup restore Restore data/}).click();
 await page.route('**/api/v1/portal/status',r=>r.fulfill({json:{...payload,tasks:payload.tasks.map(t=>t.task_id==='backup-restore'?{...t,stages:stages('passed'),required_checks:[]}:t)}}));
 await page.getByRole('button',{name:'Refresh status'}).click();
 await expect(page.getByRole('heading',{name:'Verification passed',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Backup restore Restore data/})).toHaveAttribute('aria-pressed','true');
});
test('displays invalid-snapshot diagnostics and honest local telemetry',async({page})=>{
 await page.route('**/api/v1/portal/status',r=>r.fulfill({json:{...payload,connection:'Local repo synced',intent_current:false,diagnostics:[{code:'invalid_manifest',message:'Evidence manifest is malformed.'}]}}));
 await page.getByRole('button',{name:'Refresh status'}).click();
 await expect(page.getByRole('alert')).toContainText('Evidence manifest is malformed.');
 await expect(page.getByText('Local repo synced',{exact:true})).toBeVisible();
 await expect(page.getByText('intent.md changed',{exact:true})).toBeVisible();
});
test('contains mobile overflow within tables',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:/Backup restore Restore data/}).click();
 await expect(page.getByRole('heading',{name:'Verification blocked',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../artifacts/portal-mobile.png',fullPage:true});
});
