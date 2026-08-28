# Auth-Gated App Testing Playbook (Emergent Google OAuth)

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  display_name: 'Test User',
  onboarded: false,
  id_verified: false,
  verification_status: 'unstarted',
  debates: 0,
  minds_changed: 0,
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```
curl -X GET "$API_URL/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing (Playwright)
```
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com");
```

## Checklist
- User doc uses `user_id` (custom UUID). All queries use `{"_id": 0}` projection.
- Session `user_id` matches user.user_id exactly.
- API returns user data (not 401) for authenticated calls.
- Dashboard loads without redirect when session_token cookie is set.
