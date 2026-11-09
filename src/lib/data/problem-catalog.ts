// Canonical Puvexa problem catalog — PUV-0001 … PUV-0500.
//
// Exactly 500 unique records, grouped10 per primary section (see
// problem-sections.ts). Titles are discovery seeds written the way real
// users describe failures. Tags, platforms, technologies, slugs, and
// searchable text are derived in problems.ts from these records plus the
// owning section defaults — no fabricated metrics or verification claims.

import type { RawProblem } from "./problem-types";

export const PROBLEM_CATALOG: readonly RawProblem[] = [
  // ------------------------------------------------------------------
  // SECTION 01 — React (PUV-0001 … PUV-0010)
  // ------------------------------------------------------------------
  { id: "PUV-0001", title: "React component keeps rendering in an infinite loop" },
  { id: "PUV-0002", title: "React state resets when the parent component re-renders" },
  { id: "PUV-0003", title: "React controlled input loses the value while typing" },
  { id: "PUV-0004", title: "React list keeps showing duplicate key warnings" },
  { id: "PUV-0005", title: "React useEffect runs twice even though dependencies did not change" },
  { id: "PUV-0006", title: "React button click updates state but the UI does not refresh" },
  { id: "PUV-0007", title: "React context value is undefined inside a nested component" },
  { id: "PUV-0008", title: "React form submits twice after one button click" },
  { id: "PUV-0009", title: "React modal closes immediately after opening" },
  { id: "PUV-0010", title: "React app becomes very slow after rendering a large list" },

  // ------------------------------------------------------------------
  // SECTION 02 — Next.js (PUV-0011 … PUV-0020)
  // ------------------------------------------------------------------
  { id: "PUV-0011", title: "Next.js hydration error appears only after production build" },
  { id: "PUV-0012", title: "Next.js API route returns HTML instead of JSON" },
  { id: "PUV-0013", title: "Next.js environment variable works locally but is undefined after deployment" },
  { id: "PUV-0014", title: "Next.js page works locally but returns 404 in production" },
  { id: "PUV-0015", title: "Next.js image loads locally but fails after deployment" },
  { id: "PUV-0016", title: "Next.js middleware keeps redirecting users in a loop" },
  { id: "PUV-0017", title: "Next.js server component fails when accessing browser APIs" },
  { id: "PUV-0018", title: "Next.js dynamic route does not refresh after changing parameters" },
  { id: "PUV-0019", title: "Next.js authentication session disappears after refresh" },
  { id: "PUV-0020", title: "Next.js build runs out of memory on deployment" },

  // ------------------------------------------------------------------
  // SECTION 03 — JavaScript & TypeScript (PUV-0021 … PUV-0030)
  // ------------------------------------------------------------------
  { id: "PUV-0021", title: "JavaScript this is undefined inside a callback" },
  { id: "PUV-0022", title: "JavaScript async function returns before expected work finishes" },
  { id: "PUV-0023", title: "Promise rejection appears without showing the original error" },
  { id: "PUV-0024", title: "TypeScript says property does not exist even after type checking" },
  { id: "PUV-0025", title: "TypeScript cannot find declarations for an installed package" },
  { id: "PUV-0026", title: "TypeScript build passes locally but fails in CI" },
  { id: "PUV-0027", title: "JavaScript date shows a different day because of timezone conversion" },
  { id: "PUV-0028", title: "Optional chaining still throws an undefined error" },
  { id: "PUV-0029", title: "JSON.parse fails even though the response looks like JSON" },
  { id: "PUV-0030", title: "Array values change unexpectedly after copying an object" },

  // ------------------------------------------------------------------
  // SECTION 04 — Node.js & Express (PUV-0031 … PUV-0040)
  // ------------------------------------------------------------------
  { id: "PUV-0031", title: "Node.js process runs out of memory during a large build" },
  { id: "PUV-0032", title: "Express req.body is empty even though JSON was sent" },
  { id: "PUV-0033", title: "Express middleware order breaks authentication" },
  { id: "PUV-0034", title: "Node.js server keeps port open after process exits" },
  { id: "PUV-0035", title: "Node.js reads a file before another process finishes writing it" },
  { id: "PUV-0036", title: "Express API returns 404 for a route that exists" },
  { id: "PUV-0037", title: "Node.js application crashes with unhandled promise rejection" },
  { id: "PUV-0038", title: "Express cookies work locally but disappear in production" },
  { id: "PUV-0039", title: "Node.js cannot import an ES module from a CommonJS project" },
  { id: "PUV-0040", title: "Express API becomes slow after many simultaneous requests" },

  // ------------------------------------------------------------------
  // SECTION 05 — Python (PUV-0041 … PUV-0050)
  // ------------------------------------------------------------------
  { id: "PUV-0041", title: "Python says ModuleNotFoundError even though package is installed" },
  { id: "PUV-0042", title: "pip installs package into the wrong Python environment" },
  { id: "PUV-0043", title: "Python virtual environment activates but uses system Python" },
  { id: "PUV-0044", title: "Python script works manually but fails when run as a service" },
  { id: "PUV-0045", title: "Python multiprocessing hangs without showing an error" },
  { id: "PUV-0046", title: "Python requests call times out only on one server" },
  { id: "PUV-0047", title: "Python cannot open a file that clearly exists" },
  { id: "PUV-0048", title: "Python UnicodeDecodeError appears when reading a CSV" },
  { id: "PUV-0049", title: "Python dependency version conflict appears after pip install" },
  { id: "PUV-0050", title: "Python script consumes more memory each time it runs" },

  // ------------------------------------------------------------------
  // SECTION 06 — Django / Flask / FastAPI (PUV-0051 … PUV-0060)
  // ------------------------------------------------------------------
  { id: "PUV-0051", title: "FastAPI CORS works locally but fails after deployment" },
  { id: "PUV-0052", title: "FastAPI returns 422 for a request that looks correct" },
  { id: "PUV-0053", title: "FastAPI background task does not finish after response" },
  { id: "PUV-0054", title: "Django says ImproperlyConfigured for static files" },
  { id: "PUV-0055", title: "Django migration exists but database table is missing" },
  { id: "PUV-0056", title: "Django admin login keeps redirecting back to login" },
  { id: "PUV-0057", title: "Flask session cookie disappears between requests" },
  { id: "PUV-0058", title: "Flask app works locally but returns 502 behind Nginx" },
  { id: "PUV-0059", title: "Django CSRF verification fails only in production" },
  { id: "PUV-0060", title: "FastAPI dependency injection returns None unexpectedly" },

  // ------------------------------------------------------------------
  // SECTION 07 — npm / pnpm / Packages (PUV-0061 … PUV-0070)
  // ------------------------------------------------------------------
  { id: "PUV-0061", title: "npm install fails with dependency resolution error" },
  { id: "PUV-0062", title: "npm install works on one computer but fails on another" },
  { id: "PUV-0063", title: "npm package is installed but command is not recognized" },
  { id: "PUV-0064", title: "npm keeps installing an older version of a package" },
  { id: "PUV-0065", title: "pnpm creates multiple versions of the same dependency" },
  { id: "PUV-0066", title: "package-lock changes after every npm install" },
  { id: "PUV-0067", title: "node_modules becomes corrupted after switching branches" },
  { id: "PUV-0068", title: "npm audit fix breaks working dependencies" },
  { id: "PUV-0069", title: "global npm package is installed but unavailable in terminal" },
  { id: "PUV-0070", title: "package works in development but is missing in production" },

  // ------------------------------------------------------------------
  // SECTION 08 — Git & GitHub (PUV-0071 … PUV-0080)
  // ------------------------------------------------------------------
  { id: "PUV-0071", title: "Git merge conflict returns after the file was resolved" },
  { id: "PUV-0072", title: "Git push is rejected even after pulling latest changes" },
  { id: "PUV-0073", title: "Git says branch is ahead and behind at the same time" },
  { id: "PUV-0074", title: "Git ignores file changes that should be tracked" },
  { id: "PUV-0075", title: "Git submodule remains on an old commit after cloning" },
  { id: "PUV-0076", title: "GitHub Actions passes locally but fails in workflow" },
  { id: "PUV-0077", title: "Git accidentally committed a large file and push is rejected" },
  { id: "PUV-0078", title: "Git credentials keep being requested on every push" },
  { id: "PUV-0079", title: "Git branch disappeared after rebase" },
  { id: "PUV-0080", title: "GitHub pull request shows files that were not changed" },

  // ------------------------------------------------------------------
  // SECTION 09 — Docker (PUV-0081 … PUV-0090)
  // ------------------------------------------------------------------
  { id: "PUV-0081", title: "Docker says port is already allocated but no container is running" },
  { id: "PUV-0082", title: "Docker container exits immediately after starting" },
  { id: "PUV-0083", title: "Docker container cannot connect to service running on host" },
  { id: "PUV-0084", title: "Docker build does not include a required file" },
  { id: "PUV-0085", title: "Docker image keeps using old application code" },
  { id: "PUV-0086", title: "Docker Compose service cannot resolve another service name" },
  { id: "PUV-0087", title: "Docker volume changes are missing after container restart" },
  { id: "PUV-0088", title: "Docker container works locally but fails on server" },
  { id: "PUV-0089", title: "Docker build takes extremely long after a small code change" },
  { id: "PUV-0090", title: "Docker container runs but mapped port cannot be reached" },

  // ------------------------------------------------------------------
  // SECTION 10 — Kubernetes (PUV-0091 … PUV-0100)
  // ------------------------------------------------------------------
  { id: "PUV-0091", title: "Kubernetes pod is stuck in CrashLoopBackOff" },
  { id: "PUV-0092", title: "Kubernetes pod remains Pending with no obvious error" },
  { id: "PUV-0093", title: "Kubernetes service points to the wrong pod" },
  { id: "PUV-0094", title: "Kubernetes ingress returns 502 while pod is healthy" },
  { id: "PUV-0095", title: "Kubernetes secret changes are not visible inside pod" },
  { id: "PUV-0096", title: "Kubernetes deployment uses old image after redeploy" },
  { id: "PUV-0097", title: "Kubernetes pod restarts because of memory limits" },
  { id: "PUV-0098", title: "Kubernetes service DNS sometimes fails to resolve" },
  { id: "PUV-0099", title: "Kubernetes readiness probe fails while application works" },
  { id: "PUV-0100", title: "Kubernetes persistent volume stays attached to deleted pod" },

  // ------------------------------------------------------------------
  // SECTION 11 — PostgreSQL (PUV-0101 … PUV-0110)
  // ------------------------------------------------------------------
  { id: "PUV-0101", title: "PostgreSQL works locally but refuses remote connection" },
  { id: "PUV-0102", title: "PostgreSQL duplicate key appears during concurrent inserts" },
  { id: "PUV-0103", title: "PostgreSQL query becomes slow after table grows" },
  { id: "PUV-0104", title: "PostgreSQL connection pool becomes exhausted" },
  { id: "PUV-0105", title: "PostgreSQL migration locks production table" },
  { id: "PUV-0106", title: "PostgreSQL database uses much more disk space than expected" },
  { id: "PUV-0107", title: "PostgreSQL index exists but query planner does not use it" },
  { id: "PUV-0108", title: "PostgreSQL transaction remains idle and blocks other queries" },
  { id: "PUV-0109", title: "PostgreSQL sequence generates duplicate ID after data import" },
  { id: "PUV-0110", title: "PostgreSQL timezone values differ between application and database" },

  // ------------------------------------------------------------------
  // SECTION 12 — MySQL / MariaDB (PUV-0111 … PUV-0120)
  // ------------------------------------------------------------------
  { id: "PUV-0111", title: "MySQL query remains slow even after adding an index" },
  { id: "PUV-0112", title: "MySQL connection drops during large import" },
  { id: "PUV-0113", title: "MySQL server refuses connection from another machine" },
  { id: "PUV-0114", title: "MySQL table reports incorrect auto increment value" },
  { id: "PUV-0115", title: "MariaDB replication stops after network interruption" },
  { id: "PUV-0116", title: "MySQL character encoding corrupts special characters" },
  { id: "PUV-0117", title: "MySQL deadlock appears during normal updates" },
  { id: "PUV-0118", title: "MySQL database becomes read-only unexpectedly" },
  { id: "PUV-0119", title: "MySQL backup restores without all rows" },
  { id: "PUV-0120", title: "MySQL connection count keeps increasing without closing" },

  // ------------------------------------------------------------------
  // SECTION 13 — MongoDB / Redis (PUV-0121 … PUV-0130)
  // ------------------------------------------------------------------
  { id: "PUV-0121", title: "MongoDB connection pool exhausts under moderate traffic" },
  { id: "PUV-0122", title: "MongoDB query becomes slow after collection grows" },
  { id: "PUV-0123", title: "MongoDB duplicate records appear during retries" },
  { id: "PUV-0124", title: "MongoDB aggregation works locally but times out in production" },
  { id: "PUV-0125", title: "MongoDB replica set cannot elect a primary" },
  { id: "PUV-0126", title: "Redis cache returns stale data after update" },
  { id: "PUV-0127", title: "Redis memory usage keeps growing unexpectedly" },
  { id: "PUV-0128", title: "Redis connection suddenly resets under load" },
  { id: "PUV-0129", title: "Redis key expires earlier than expected" },
  { id: "PUV-0130", title: "Redis service starts but application cannot authenticate" },

  // ------------------------------------------------------------------
  // SECTION 14 — Supabase / Firebase (PUV-0131 … PUV-0140)
  // ------------------------------------------------------------------
  { id: "PUV-0131", title: "Supabase session disappears after page refresh" },
  { id: "PUV-0132", title: "Supabase RLS blocks authenticated user unexpectedly" },
  { id: "PUV-0133", title: "Supabase insert works but returned row is empty" },
  { id: "PUV-0134", title: "Supabase realtime subscription stops updating" },
  { id: "PUV-0135", title: "Supabase OAuth redirect works locally but fails in production" },
  { id: "PUV-0136", title: "Firebase rules reject a read that should be allowed" },
  { id: "PUV-0137", title: "Firebase authentication user exists but session is missing" },
  { id: "PUV-0138", title: "Firebase push notification arrives only when app is open" },
  { id: "PUV-0139", title: "Firestore query requires an index after deployment" },
  { id: "PUV-0140", title: "Firebase environment configuration points to wrong project" },

  // ------------------------------------------------------------------
  // SECTION 15 — API & Authentication (PUV-0141 … PUV-0150)
  // ------------------------------------------------------------------
  { id: "PUV-0141", title: "API returns 401 even though JWT token is present" },
  { id: "PUV-0142", title: "API returns 403 for user with correct role" },
  { id: "PUV-0143", title: "Refresh token works once and then becomes invalid" },
  { id: "PUV-0144", title: "OAuth redirect enters an infinite login loop" },
  { id: "PUV-0145", title: "API request works in Postman but fails in browser" },
  { id: "PUV-0146", title: "API returns different response after reverse proxy" },
  { id: "PUV-0147", title: "API rate limit triggers too quickly behind shared IP" },
  { id: "PUV-0148", title: "JWT appears valid but backend rejects signature" },
  { id: "PUV-0149", title: "User stays logged in after access should have expired" },
  { id: "PUV-0150", title: "Login works but authenticated API calls still fail" },

  // ------------------------------------------------------------------
  // SECTION 16 — CORS / HTTP / SSL (PUV-0151 … PUV-0160)
  // ------------------------------------------------------------------
  { id: "PUV-0151", title: "CORS preflight fails when request includes credentials" },
  { id: "PUV-0152", title: "HTTPS site loads but API call is blocked as mixed content" },
  { id: "PUV-0153", title: "SSL certificate works in browser but API client rejects it" },
  { id: "PUV-0154", title: "Browser redirects HTTP to HTTPS repeatedly" },
  { id: "PUV-0155", title: "API returns 413 when uploading a normal file" },
  { id: "PUV-0156", title: "Reverse proxy strips required authorization header" },
  { id: "PUV-0157", title: "HTTP request succeeds but browser reports CORS failure" },
  { id: "PUV-0158", title: "TLS certificate renewal completes but old certificate remains active" },
  { id: "PUV-0159", title: "WebSocket connects locally but fails behind HTTPS proxy" },
  { id: "PUV-0160", title: "Browser caches an old redirect after server configuration changed" },

  // ------------------------------------------------------------------
  // SECTION 17 — Windows Update & Boot (PUV-0161 … PUV-0170)
  // ------------------------------------------------------------------
  { id: "PUV-0161", title: "Windows Update fails with error 0x800f0986" },
  { id: "PUV-0162", title: "Windows update downloads but fails during installation" },
  { id: "PUV-0163", title: "Windows blue screens during every startup attempt" },
  { id: "PUV-0164", title: "Windows enters automatic repair loop" },
  { id: "PUV-0165", title: "Windows boots to black screen with mouse cursor" },
  { id: "PUV-0166", title: "Windows update gets stuck at the same percentage" },
  { id: "PUV-0167", title: "Windows restarts repeatedly after installing an update" },
  { id: "PUV-0168", title: "Windows rollback says unable to uninstall latest update" },
  { id: "PUV-0169", title: "Windows boot takes much longer after recent update" },
  { id: "PUV-0170", title: "Windows update says device is missing important fixes" },

  // ------------------------------------------------------------------
  // SECTION 18 — Windows Performance (PUV-0171 … PUV-0180)
  // ------------------------------------------------------------------
  { id: "PUV-0171", title: "Windows disk usage stays at 100 percent while idle" },
  { id: "PUV-0172", title: "Windows becomes extremely slow after driver update" },
  { id: "PUV-0173", title: "Windows memory usage remains high with few apps open" },
  { id: "PUV-0174", title: "Windows CPU stays at 100 percent after startup" },
  { id: "PUV-0175", title: "Windows laptop becomes slow only when running on battery" },
  { id: "PUV-0176", title: "Windows freezes randomly for several seconds" },
  { id: "PUV-0177", title: "Windows login takes minutes before desktop becomes usable" },
  { id: "PUV-0178", title: "Windows desktop stutters when moving windows" },
  { id: "PUV-0179", title: "Windows becomes slower after waking from sleep" },
  { id: "PUV-0180", title: "Windows background process keeps consuming CPU" },

  // ------------------------------------------------------------------
  // SECTION 19 — Windows Files & Storage (PUV-0181 … PUV-0190)
  // ------------------------------------------------------------------
  { id: "PUV-0181", title: "File Explorer crashes when opening folder with many files" },
  { id: "PUV-0182", title: "Windows Search cannot find files that clearly exist" },
  { id: "PUV-0183", title: "Drive shows full but visible files use much less space" },
  { id: "PUV-0184", title: "Windows says drive must be formatted even though it contains data" },
  { id: "PUV-0185", title: "External drive remains stuck on safely remove" },
  { id: "PUV-0186", title: "USB drive letter changes whenever it reconnects" },
  { id: "PUV-0187", title: "File cannot be deleted because Windows says it is in use" },
  { id: "PUV-0188", title: "Recycle Bin shows empty but disk space is not restored" },
  { id: "PUV-0189", title: "Windows cannot copy large file even though drive has free space" },
  { id: "PUV-0190", title: "OneDrive file appears available but cannot open offline" },

  // ------------------------------------------------------------------
  // SECTION 20 — Windows UI & Apps (PUV-0191 … PUV-0200)
  // ------------------------------------------------------------------
  { id: "PUV-0191", title: "Windows Settings app closes immediately after opening" },
  { id: "PUV-0192", title: "Windows taskbar shows duplicate icons for one application" },
  { id: "PUV-0193", title: "Start menu search stops returning installed applications" },
  { id: "PUV-0194", title: "Windows context menu is missing expected options" },
  { id: "PUV-0195", title: "Clipboard history does not sync between devices" },
  { id: "PUV-0196", title: "Default application resets after every update" },
  { id: "PUV-0197", title: "Windows notifications stop appearing completely" },
  { id: "PUV-0198", title: "Microsoft Store download stays pending forever" },
  { id: "PUV-0199", title: "Windows startup apps keep enabling themselves again" },
  { id: "PUV-0200", title: "App opens off-screen and cannot be moved back" },

  // ------------------------------------------------------------------
  // SECTION 21 — macOS (PUV-0201 … PUV-0210)
  // ------------------------------------------------------------------
  { id: "PUV-0201", title: "macOS external display stays black after waking" },
  { id: "PUV-0202", title: "macOS battery drains while lid is closed" },
  { id: "PUV-0203", title: "Spotlight cannot find installed applications" },
  { id: "PUV-0204", title: "Finder keeps indexing the same folder repeatedly" },
  { id: "PUV-0205", title: "macOS Mail keeps asking for a correct password" },
  { id: "PUV-0206", title: "macOS application cannot be opened because developer cannot be verified" },
  { id: "PUV-0207", title: "macOS storage shows huge System Data usage" },
  { id: "PUV-0208", title: "macOS Wi-Fi reconnects slowly after waking" },
  { id: "PUV-0209", title: "macOS Bluetooth device keeps disconnecting" },
  { id: "PUV-0210", title: "macOS update downloads but refuses to install" },

  // ------------------------------------------------------------------
  // SECTION 22 — Linux (PUV-0211 … PUV-0220)
  // ------------------------------------------------------------------
  { id: "PUV-0211", title: "Linux freezes on black screen after kernel update" },
  { id: "PUV-0212", title: "GRUB shows only an older kernel" },
  { id: "PUV-0213", title: "Linux cannot mount NTFS drive after Windows update" },
  { id: "PUV-0214", title: "Linux cron job runs but script produces no expected result" },
  { id: "PUV-0215", title: "Linux Wi-Fi interface disappears after suspend" },
  { id: "PUV-0216", title: "Linux package manager reports broken dependencies" },
  { id: "PUV-0217", title: "Linux boot becomes slow after installing new service" },
  { id: "PUV-0218", title: "Linux audio device disappears after kernel upgrade" },
  { id: "PUV-0219", title: "Linux filesystem becomes read-only unexpectedly" },
  { id: "PUV-0220", title: "Linux application works in terminal but not from desktop launcher" },

  // ------------------------------------------------------------------
  // SECTION 23 — Laptop Battery & Power (PUV-0221 … PUV-0230)
  // ------------------------------------------------------------------
  { id: "PUV-0221", title: "Laptop battery drains unusually fast after update" },
  { id: "PUV-0222", title: "Laptop shuts down while battery still shows 30 percent" },
  { id: "PUV-0223", title: "Laptop battery percentage jumps up and down" },
  { id: "PUV-0224", title: "Laptop does not charge even though charger is connected" },
  { id: "PUV-0225", title: "Laptop charges only when powered off" },
  { id: "PUV-0226", title: "Laptop wakes from sleep inside a closed bag" },
  { id: "PUV-0227", title: "Laptop becomes much slower below 20 percent battery" },
  { id: "PUV-0228", title: "Laptop battery stays at 0 percent while plugged in" },
  { id: "PUV-0229", title: "Laptop stops charging at 80 percent" },
  { id: "PUV-0230", title: "Laptop loses battery overnight while fully shut down" },

  // ------------------------------------------------------------------
  // SECTION 24 — PC Hardware & Performance (PUV-0231 … PUV-0240)
  // ------------------------------------------------------------------
  { id: "PUV-0231", title: "Desktop PC restarts during gaming under high load" },
  { id: "PUV-0232", title: "PC powers on but monitor shows no signal" },
  { id: "PUV-0233", title: "PC shuts down immediately after pressing power button" },
  { id: "PUV-0234", title: "Computer freezes when RAM usage becomes high" },
  { id: "PUV-0235", title: "PC randomly restarts without blue screen" },
  { id: "PUV-0236", title: "Computer runs hot even while idle" },
  { id: "PUV-0237", title: "CPU frequency stays low under heavy workload" },
  { id: "PUV-0238", title: "PC becomes unstable after enabling XMP" },
  { id: "PUV-0239", title: "Computer takes several attempts to power on" },
  { id: "PUV-0240", title: "PC fans run at maximum speed constantly" },

  // ------------------------------------------------------------------
  // SECTION 25 — GPU & Display (PUV-0241 … PUV-0250)
  // ------------------------------------------------------------------
  { id: "PUV-0241", title: "NVIDIA driver installation fails with incompatibility error" },
  { id: "PUV-0242", title: "External monitor flickers only at high refresh rate" },
  { id: "PUV-0243", title: "GPU driver crashes while gaming" },
  { id: "PUV-0244", title: "Second monitor disappears after waking from sleep" },
  { id: "PUV-0245", title: "Display resolution resets after every restart" },
  { id: "PUV-0246", title: "Screen turns black when switching to fullscreen" },
  { id: "PUV-0247", title: "Graphics driver keeps reverting to Microsoft Basic Display Adapter" },
  { id: "PUV-0248", title: "Monitor shows wrong colors after GPU update" },
  { id: "PUV-0249", title: "Laptop display works but HDMI output does not" },
  { id: "PUV-0250", title: "GPU usage remains low while game performance is poor" },

  // ------------------------------------------------------------------
  // SECTION 26 — SSD / HDD / Storage Hardware (PUV-0251 … PUV-0260)
  // ------------------------------------------------------------------
  { id: "PUV-0251", title: "New SSD is not detected in BIOS" },
  { id: "PUV-0252", title: "SSD appears in BIOS but not Windows installer" },
  { id: "PUV-0253", title: "External hard drive disconnects during large transfers" },
  { id: "PUV-0254", title: "SSD speed is far below advertised performance" },
  { id: "PUV-0255", title: "Hard drive makes clicking noises and disappears" },
  { id: "PUV-0256", title: "NVMe drive overheats during large file transfers" },
  { id: "PUV-0257", title: "New drive appears with wrong storage capacity" },
  { id: "PUV-0258", title: "Disk clone boots to recovery instead of Windows" },
  { id: "PUV-0259", title: "SSD health suddenly drops after firmware update" },
  { id: "PUV-0260", title: "External SSD works on one computer but not another" },

  // ------------------------------------------------------------------
  // SECTION 27 — Wi-Fi (PUV-0261 … PUV-0270)
  // ------------------------------------------------------------------
  { id: "PUV-0261", title: "Wi-Fi disconnects every few minutes after Windows update" },
  { id: "PUV-0262", title: "Wi-Fi shows connected but websites time out" },
  { id: "PUV-0263", title: "Wi-Fi speed is unexpectedly slow on 5 GHz" },
  { id: "PUV-0264", title: "Laptop cannot see home Wi-Fi network" },
  { id: "PUV-0265", title: "Wi-Fi adapter disappears after sleep" },
  { id: "PUV-0266", title: "One device loses Wi-Fi whenever another device connects" },
  { id: "PUV-0267", title: "Wi-Fi works on phone but not laptop" },
  { id: "PUV-0268", title: "Wi-Fi signal is strong but connection is unstable" },
  { id: "PUV-0269", title: "Wi-Fi works after restart but fails again later" },
  { id: "PUV-0270", title: "Laptop keeps connecting to weaker Wi-Fi access point" },

  // ------------------------------------------------------------------
  // SECTION 28 — Ethernet & Local Network (PUV-0271 … PUV-0280)
  // ------------------------------------------------------------------
  { id: "PUV-0271", title: "Ethernet says unidentified network after changing router" },
  { id: "PUV-0272", title: "Ethernet works but Windows keeps preferring Wi-Fi" },
  { id: "PUV-0273", title: "Two computers cannot discover each other on local network" },
  { id: "PUV-0274", title: "Network file sharing keeps asking for correct credentials" },
  { id: "PUV-0275", title: "Ethernet speed negotiates at 100 Mbps instead of 1 Gbps" },
  { id: "PUV-0276", title: "Network drive disconnects randomly" },
  { id: "PUV-0277", title: "Computer receives IP address but cannot reach gateway" },
  { id: "PUV-0278", title: "Local server works from one device but not another" },
  { id: "PUV-0279", title: "Ethernet connection drops when large transfer starts" },
  { id: "PUV-0280", title: "Network adapter shows cable unplugged while cable is connected" },

  // ------------------------------------------------------------------
  // SECTION 29 — Internet / DNS / Router (PUV-0281 … PUV-0290)
  // ------------------------------------------------------------------
  { id: "PUV-0281", title: "Internet is fast in morning but slow every evening" },
  { id: "PUV-0282", title: "One website returns connection reset on every browser" },
  { id: "PUV-0283", title: "DNS lookup takes longer than page loading" },
  { id: "PUV-0284", title: "Router admin page loads only after repeated refreshes" },
  { id: "PUV-0285", title: "Internet disconnects at the same time every hour" },
  { id: "PUV-0286", title: "Speed test is fast but downloads keep stalling" },
  { id: "PUV-0287", title: "Router restarts during heavy network activity" },
  { id: "PUV-0288", title: "Local DNS stops resolving after router reboot" },
  { id: "PUV-0289", title: "Internet works by IP address but not domain name" },
  { id: "PUV-0290", title: "Router shows internet connected but no device can browse" },

  // ------------------------------------------------------------------
  // SECTION 30 — Bluetooth (PUV-0291 … PUV-0300)
  // ------------------------------------------------------------------
  { id: "PUV-0291", title: "Bluetooth headphones connect but no audio plays" },
  { id: "PUV-0292", title: "Bluetooth mouse stutters when USB 3 drive is active" },
  { id: "PUV-0293", title: "Bluetooth will not turn on after sleep" },
  { id: "PUV-0294", title: "Bluetooth pairing succeeds but device disappears" },
  { id: "PUV-0295", title: "Bluetooth device reconnects repeatedly on battery" },
  { id: "PUV-0296", title: "Bluetooth audio quality suddenly becomes very poor" },
  { id: "PUV-0297", title: "Bluetooth headphones microphone disables stereo audio" },
  { id: "PUV-0298", title: "Bluetooth keyboard connects but stops typing" },
  { id: "PUV-0299", title: "Bluetooth speaker has noticeable audio delay" },
  { id: "PUV-0300", title: "Bluetooth device works on phone but not laptop" },

  // ------------------------------------------------------------------
  // SECTION 31 — VPN (PUV-0301 … PUV-0310)
  // ------------------------------------------------------------------
  { id: "PUV-0301", title: "VPN disconnects after a few minutes of inactivity" },
  { id: "PUV-0302", title: "VPN connects but internet stops working" },
  { id: "PUV-0303", title: "VPN works for web browsing but breaks file shares" },
  { id: "PUV-0304", title: "VPN connection succeeds but office server is unreachable" },
  { id: "PUV-0305", title: "VPN reconnect causes mapped drive to disconnect" },
  { id: "PUV-0306", title: "VPN works on Wi-Fi but not mobile hotspot" },
  { id: "PUV-0307", title: "VPN DNS leaks outside encrypted connection" },
  { id: "PUV-0308", title: "VPN client gets stuck while connecting" },
  { id: "PUV-0309", title: "VPN speed becomes extremely slow after connection" },
  { id: "PUV-0310", title: "VPN authentication succeeds but tunnel does not establish" },

  // ------------------------------------------------------------------
  // SECTION 32 — Printers & Scanners (PUV-0311 … PUV-0320)
  // ------------------------------------------------------------------
  { id: "PUV-0311", title: "Printer is detected but jobs remain stuck in queue" },
  { id: "PUV-0312", title: "Printer says offline even though phone can print" },
  { id: "PUV-0313", title: "Printer outputs blank pages from one application" },
  { id: "PUV-0314", title: "Print jobs work only after restarting spooler" },
  { id: "PUV-0315", title: "Printer driver installation rolls back at the end" },
  { id: "PUV-0316", title: "Scanner is detected but scan button does nothing" },
  { id: "PUV-0317", title: "Printer repeatedly prints the same old document" },
  { id: "PUV-0318", title: "Wireless printer gets a different IP and disappears" },
  { id: "PUV-0319", title: "Printer prints symbols instead of document text" },
  { id: "PUV-0320", title: "Duplex printing option disappeared after driver update" },

  // ------------------------------------------------------------------
  // SECTION 33 — Audio / Microphone / Camera (PUV-0321 … PUV-0330)
  // ------------------------------------------------------------------
  { id: "PUV-0321", title: "Audio device disappears after every restart" },
  { id: "PUV-0322", title: "Microphone works in one app but not another" },
  { id: "PUV-0323", title: "Webcam works in browser but not video-call app" },
  { id: "PUV-0324", title: "Headphones are detected but sound comes from speakers" },
  { id: "PUV-0325", title: "Microphone volume keeps resetting automatically" },
  { id: "PUV-0326", title: "Audio crackles when CPU usage increases" },
  { id: "PUV-0327", title: "Webcam image freezes during video calls" },
  { id: "PUV-0328", title: "Laptop speakers stop working after Bluetooth disconnects" },
  { id: "PUV-0329", title: "USB microphone disconnects during recording" },
  { id: "PUV-0330", title: "Camera permission is enabled but app still cannot access camera" },

  // ------------------------------------------------------------------
  // SECTION 34 — Android (PUV-0331 … PUV-0340)
  // ------------------------------------------------------------------
  { id: "PUV-0331", title: "Android battery drains quickly after system update" },
  { id: "PUV-0332", title: "Android app keeps crashing immediately after opening" },
  { id: "PUV-0333", title: "Android phone shows storage full despite deleting files" },
  { id: "PUV-0334", title: "Android notifications arrive only after opening app" },
  { id: "PUV-0335", title: "Android Wi-Fi keeps disconnecting while screen is off" },
  { id: "PUV-0336", title: "Android hotspot connects but has no internet" },
  { id: "PUV-0337", title: "Android phone charges very slowly with original charger" },
  { id: "PUV-0338", title: "Android Bluetooth audio keeps cutting out" },
  { id: "PUV-0339", title: "Android app permissions reset by themselves" },
  { id: "PUV-0340", title: "Android phone becomes hot during normal use" },

  // ------------------------------------------------------------------
  // SECTION 35 — iPhone / iPad (PUV-0341 … PUV-0350)
  // ------------------------------------------------------------------
  { id: "PUV-0341", title: "iPhone battery drains quickly after iOS update" },
  { id: "PUV-0342", title: "iPhone storage remains full after deleting videos" },
  { id: "PUV-0343", title: "iPhone Wi-Fi disconnects when screen locks" },
  { id: "PUV-0344", title: "iPhone app notifications arrive late" },
  { id: "PUV-0345", title: "iPhone Bluetooth device connects but audio does not switch" },
  { id: "PUV-0346", title: "iPhone backup fails even with enough iCloud storage" },
  { id: "PUV-0347", title: "iPhone charges intermittently with working cable" },
  { id: "PUV-0348", title: "iPhone app closes whenever camera opens" },
  { id: "PUV-0349", title: "AirDrop device appears but transfer keeps failing" },
  { id: "PUV-0350", title: "iPhone hotspot connects but laptop has no internet" },

  // ------------------------------------------------------------------
  // SECTION 36 — Chrome / Edge / Firefox (PUV-0351 … PUV-0360)
  // ------------------------------------------------------------------
  { id: "PUV-0351", title: "Chrome uses too much memory with few tabs open" },
  { id: "PUV-0352", title: "Browser page keeps refreshing itself" },
  { id: "PUV-0353", title: "Browser extension works until browser restarts" },
  { id: "PUV-0354", title: "Chrome shows ERR_CONNECTION_RESET on one website" },
  { id: "PUV-0355", title: "Browser downloads stop before completion" },
  { id: "PUV-0356", title: "Browser opens unwanted tabs on startup" },
  { id: "PUV-0357", title: "Website works in incognito but not normal browser mode" },
  { id: "PUV-0358", title: "Browser saved passwords disappear after update" },
  { id: "PUV-0359", title: "Browser hardware acceleration causes flickering" },
  { id: "PUV-0360", title: "Firefox loads some pages without styles" },

  // ------------------------------------------------------------------
  // SECTION 37 — Microsoft Office (PUV-0361 … PUV-0370)
  // ------------------------------------------------------------------
  { id: "PUV-0361", title: "Excel file opens very slowly despite small size" },
  { id: "PUV-0362", title: "Excel formula does not recalculate automatically" },
  { id: "PUV-0363", title: "Word document formatting changes when opened elsewhere" },
  { id: "PUV-0364", title: "Word freezes while saving large document" },
  { id: "PUV-0365", title: "PowerPoint fonts change on another computer" },
  { id: "PUV-0366", title: "Outlook search cannot find existing emails" },
  { id: "PUV-0367", title: "Outlook keeps asking for account password" },
  { id: "PUV-0368", title: "Excel workbook says file is locked by another user" },
  { id: "PUV-0369", title: "Office activation disappears after Windows update" },
  { id: "PUV-0370", title: "PowerPoint presentation becomes corrupted after saving" },

  // ------------------------------------------------------------------
  // SECTION 38 — Google Workspace & Cloud Files (PUV-0371 … PUV-0380)
  // ------------------------------------------------------------------
  { id: "PUV-0371", title: "Google Drive desktop sync stops without error" },
  { id: "PUV-0372", title: "Google Drive file shows different version on two devices" },
  { id: "PUV-0373", title: "Google Docs formatting changes after importing Word file" },
  { id: "PUV-0374", title: "Google Sheets formula works for some rows but not others" },
  { id: "PUV-0375", title: "Google Drive says storage full after files were deleted" },
  { id: "PUV-0376", title: "Shared Google Drive file unexpectedly becomes view-only" },
  { id: "PUV-0377", title: "Google Docs offline mode stops working" },
  { id: "PUV-0378", title: "Google Sheets becomes extremely slow with large dataset" },
  { id: "PUV-0379", title: "Google Drive folder duplicates after sync conflict" },
  { id: "PUV-0380", title: "Google account keeps requesting sign-in in desktop app" },

  // ------------------------------------------------------------------
  // SECTION 39 — Zoom / Teams / Meet (PUV-0381 … PUV-0390)
  // ------------------------------------------------------------------
  { id: "PUV-0381", title: "Zoom microphone works in settings but not meeting" },
  { id: "PUV-0382", title: "Microsoft Teams camera shows black screen" },
  { id: "PUV-0383", title: "Google Meet audio becomes robotic during calls" },
  { id: "PUV-0384", title: "Zoom freezes when screen sharing begins" },
  { id: "PUV-0385", title: "Teams signs out repeatedly during meetings" },
  { id: "PUV-0386", title: "Video-call application uses wrong microphone automatically" },
  { id: "PUV-0387", title: "Background blur causes severe video lag" },
  { id: "PUV-0388", title: "Screen share appears black to other participants" },
  { id: "PUV-0389", title: "Bluetooth headset switches to low-quality audio during meetings" },
  { id: "PUV-0390", title: "Video call drops while normal internet browsing still works" },

  // ------------------------------------------------------------------
  // SECTION 40 — VS Code & IDEs (PUV-0391 … PUV-0400)
  // ------------------------------------------------------------------
  { id: "PUV-0391", title: "VS Code IntelliSense stops suggesting imports" },
  { id: "PUV-0392", title: "VS Code terminal uses wrong Python environment" },
  { id: "PUV-0393", title: "VS Code extension causes high CPU usage" },
  { id: "PUV-0394", title: "VS Code debugger stops at wrong line" },
  { id: "PUV-0395", title: "VS Code cannot find TypeScript installed in project" },
  { id: "PUV-0396", title: "IDE marks valid imports as unresolved" },
  { id: "PUV-0397", title: "VS Code settings sync keeps restoring old configuration" },
  { id: "PUV-0398", title: "VS Code remote SSH connection disconnects repeatedly" },
  { id: "PUV-0399", title: "IDE build works but debugger cannot launch application" },
  { id: "PUV-0400", title: "VS Code formatting changes file every time it is saved" },

  // ------------------------------------------------------------------
  // SECTION 41 — CI/CD (PUV-0401 … PUV-0410)
  // ------------------------------------------------------------------
  { id: "PUV-0401", title: "CI pipeline fails even though project builds locally" },
  { id: "PUV-0402", title: "GitHub Actions cannot access environment secret" },
  { id: "PUV-0403", title: "CI cache keeps restoring outdated dependencies" },
  { id: "PUV-0404", title: "Deployment pipeline succeeds but old code remains live" },
  { id: "PUV-0405", title: "CI test randomly fails only on runner" },
  { id: "PUV-0406", title: "Docker build passes locally but fails in CI" },
  { id: "PUV-0407", title: "Deployment job cannot connect to production server" },
  { id: "PUV-0408", title: "CI pipeline exceeds memory limit during build" },
  { id: "PUV-0409", title: "Workflow triggers twice for one commit" },
  { id: "PUV-0410", title: "Production deployment finishes but health check fails" },

  // ------------------------------------------------------------------
  // SECTION 42 — AWS / Cloud (PUV-0411 … PUV-0420)
  // ------------------------------------------------------------------
  { id: "PUV-0411", title: "EC2 instance is running but website cannot be reached" },
  { id: "PUV-0412", title: "AWS security group looks correct but port remains blocked" },
  { id: "PUV-0413", title: "S3 file is uploaded but public URL returns access denied" },
  { id: "PUV-0414", title: "Lambda works in test console but fails through API Gateway" },
  { id: "PUV-0415", title: "AWS credentials work locally but fail on server" },
  { id: "PUV-0416", title: "Cloud server runs out of disk space unexpectedly" },
  { id: "PUV-0417", title: "Load balancer health check fails while app works directly" },
  { id: "PUV-0418", title: "Server becomes unreachable after firewall change" },
  { id: "PUV-0419", title: "Cloud instance reboots and application does not restart" },
  { id: "PUV-0420", title: "DNS record points correctly but domain still reaches old server" },

  // ------------------------------------------------------------------
  // SECTION 43 — Nginx / Apache / Web Servers (PUV-0421 … PUV-0430)
  // ------------------------------------------------------------------
  { id: "PUV-0421", title: "Nginx returns 502 while backend service is running" },
  { id: "PUV-0422", title: "Nginx redirect creates an infinite loop" },
  { id: "PUV-0423", title: "Nginx serves old static files after deployment" },
  { id: "PUV-0424", title: "Nginx upload fails for larger files" },
  { id: "PUV-0425", title: "Nginx WebSocket connection closes immediately" },
  { id: "PUV-0426", title: "Apache virtual host loads wrong website" },
  { id: "PUV-0427", title: "Apache rewrite rules work locally but not server" },
  { id: "PUV-0428", title: "Reverse proxy loses client IP address" },
  { id: "PUV-0429", title: "Nginx SSL configuration works for one domain but not another" },
  { id: "PUV-0430", title: "Web server reports permission denied for readable files" },

  // ------------------------------------------------------------------
  // SECTION 44 — Domain / DNS / Email (PUV-0431 … PUV-0440)
  // ------------------------------------------------------------------
  { id: "PUV-0431", title: "Domain points to old server after DNS change" },
  { id: "PUV-0432", title: "DNS record resolves differently on different networks" },
  { id: "PUV-0433", title: "Custom domain works without www but not with www" },
  { id: "PUV-0434", title: "Email sent from domain lands in spam" },
  { id: "PUV-0435", title: "SPF passes but DKIM fails" },
  { id: "PUV-0436", title: "MX records look correct but incoming mail never arrives" },
  { id: "PUV-0437", title: "Domain verification keeps failing despite correct TXT record" },
  { id: "PUV-0438", title: "Email works from webmail but not desktop client" },
  { id: "PUV-0439", title: "DNS propagation seems stuck after many hours" },
  { id: "PUV-0440", title: "Subdomain works over HTTP but not HTTPS" },

  // ------------------------------------------------------------------
  // SECTION 45 — Security & Permissions (PUV-0441 … PUV-0450)
  // ------------------------------------------------------------------
  { id: "PUV-0441", title: "Application says permission denied even as administrator" },
  { id: "PUV-0442", title: "Folder permissions reset after reboot" },
  { id: "PUV-0443", title: "Service account can read file but application cannot" },
  { id: "PUV-0444", title: "Firewall blocks application even after allow rule" },
  { id: "PUV-0445", title: "Antivirus quarantines a legitimate application repeatedly" },
  { id: "PUV-0446", title: "File ownership changes after deployment" },
  { id: "PUV-0447", title: "User receives access denied only on one computer" },
  { id: "PUV-0448", title: "Application works as root but fails as normal user" },
  { id: "PUV-0449", title: "Security policy prevents script from running" },
  { id: "PUV-0450", title: "Account is repeatedly locked despite correct password" },

  // ------------------------------------------------------------------
  // SECTION 46 — Email Clients (PUV-0451 … PUV-0460)
  // ------------------------------------------------------------------
  { id: "PUV-0451", title: "Email sends successfully but never reaches recipient" },
  { id: "PUV-0452", title: "Email client keeps downloading the same messages" },
  { id: "PUV-0453", title: "IMAP folders do not match webmail folders" },
  { id: "PUV-0454", title: "Sent messages disappear from Sent folder" },
  { id: "PUV-0455", title: "Email attachments fail only above certain size" },
  { id: "PUV-0456", title: "Mail client shows certificate warning for valid server" },
  { id: "PUV-0457", title: "Email synchronization stops after password change" },
  { id: "PUV-0458", title: "Calendar invitations appear with wrong time" },
  { id: "PUV-0459", title: "Email client becomes extremely slow with large mailbox" },
  { id: "PUV-0460", title: "Search cannot find old messages that are still present" },

  // ------------------------------------------------------------------
  // SECTION 47 — IDE / Compiler / Build Errors (PUV-0461 … PUV-0470)
  // ------------------------------------------------------------------
  { id: "PUV-0461", title: "C++ linker reports undefined reference for installed library" },
  { id: "PUV-0462", title: "Java throws ClassNotFoundException after Maven rebuild" },
  { id: "PUV-0463", title: "Maven downloads dependencies but build cannot find them" },
  { id: "PUV-0464", title: "Gradle build works once and fails after cache update" },
  { id: "PUV-0465", title: "Compiler uses wrong version of installed SDK" },
  { id: "PUV-0466", title: "Build system cannot locate header file that exists" },
  { id: "PUV-0467", title: "Java application builds but crashes with NoClassDefFoundError" },
  { id: "PUV-0468", title: "CMake finds library locally but not in CI" },
  { id: "PUV-0469", title: "Rust cargo build fails after dependency update" },
  { id: "PUV-0470", title: "Go module resolves different package version than expected" },

  // ------------------------------------------------------------------
  // SECTION 48 — Deployment / Production-Only Problems (PUV-0471 … PUV-0480)
  // ------------------------------------------------------------------
  { id: "PUV-0471", title: "Application works locally but fails immediately in production" },
  { id: "PUV-0472", title: "Production environment variable is missing despite being configured" },
  { id: "PUV-0473", title: "Production API returns different data than local API" },
  { id: "PUV-0474", title: "Static files disappear after deployment" },
  { id: "PUV-0475", title: "Application works after deployment then fails after restart" },
  { id: "PUV-0476", title: "Production database connection fails while manual connection works" },
  { id: "PUV-0477", title: "Background jobs run locally but never execute in production" },
  { id: "PUV-0478", title: "Production timezone causes scheduled jobs to run at wrong time" },
  { id: "PUV-0479", title: "Application crashes only under real user traffic" },
  { id: "PUV-0480", title: "Deployment succeeds but browser still shows previous version" },

  // ------------------------------------------------------------------
  // SECTION 49 — Performance / Memory / Reliability (PUV-0481 … PUV-0490)
  // ------------------------------------------------------------------
  { id: "PUV-0481", title: "Application memory usage increases continuously over time" },
  { id: "PUV-0482", title: "API becomes slower after running for several hours" },
  { id: "PUV-0483", title: "Application freezes when processing large file" },
  { id: "PUV-0484", title: "CPU usage spikes during apparently simple request" },
  { id: "PUV-0485", title: "Background worker stops processing jobs without crashing" },
  { id: "PUV-0486", title: "Application occasionally returns duplicate results" },
  { id: "PUV-0487", title: "Service becomes unstable only during traffic spikes" },
  { id: "PUV-0488", title: "Scheduled job runs twice unexpectedly" },
  { id: "PUV-0489", title: "Application becomes slow after database connection reconnects" },
  { id: "PUV-0490", title: "Memory usage remains high after task finishes" },

  // ------------------------------------------------------------------
  // SECTION 50 — Common Everyday Tech Problems (PUV-0491 … PUV-0500)
  // ------------------------------------------------------------------
  { id: "PUV-0491", title: "Computer says no internet even though websites work" },
  { id: "PUV-0492", title: "USB device works only after unplugging and reconnecting" },
  { id: "PUV-0493", title: "Application keeps forgetting login after restart" },
  { id: "PUV-0494", title: "File opens correctly on one computer but not another" },
  { id: "PUV-0495", title: "Computer clock keeps changing to wrong time" },
  { id: "PUV-0496", title: "App opens but buttons stop responding" },
  { id: "PUV-0497", title: "Download completes but file cannot be opened" },
  { id: "PUV-0498", title: "Device works after reboot but problem returns later" },
  { id: "PUV-0499", title: "Software update finishes but new version is not installed" },
  { id: "PUV-0500", title: "Error disappears after restart but keeps returning every day" },
];
