
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3001;
const saltRounds = 10;
const staticDir = path.resolve(__dirname, 'dist');
const localesDir = path.resolve(__dirname, 'i18n');
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email = '') => adminEmails.includes(email.toLowerCase());

const mapUserRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        subscriptionTier: row.subscription_tier,
        isAdmin: isAdminEmail(row.email),
        firstName: row.first_name || null,
        birthDate: row.birth_date || null,
        heightCm: row.height_cm ?? null,
        weightKg: row.weight_kg ?? null,
        sex: row.sex || null
    };
};

const getDateKey = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

const differenceInDays = (dateA, dateB) => {
    const a = new Date(dateA);
    const b = new Date(dateB);
    const diff = (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diff);
};

const calculateStreak = (dateKeys) => {
    if (!dateKeys.length) return 0;
    const uniqueDays = Array.from(new Set(dateKeys)).sort((a, b) => b.localeCompare(a));
    let streak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
        const gap = differenceInDays(uniqueDays[i - 1], uniqueDays[i]);
        if (gap === 1) {
            streak += 1;
        } else if (gap > 1) {
            break;
        }
    }
    return streak;
};

const clamp = (value, min, max) => {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
};

const SHARE_DEFAULT_DAYS = 7;
const SHARE_TOKEN_BYTES = 16;

const buildShareUrl = (req, token) => {
    const base = (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    return `${base}/share/${token}`;
};

const buildMealShareUrl = (req, token) => {
    const base = (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    return `${base}/meal-share/${token}`;
};

const createShareToken = () => crypto.randomBytes(SHARE_TOKEN_BYTES).toString('hex');

const fetchPlanForUser = (planId, userId, callback) => {
    const sql = 'SELECT * FROM workout_plans WHERE id = ? AND user_id = ?';
    db.get(sql, [planId, userId], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(new Error('Plan not found'));
        callback(null, row);
    });
};

const mealScanModel = process.env.MEAL_SCAN_MODEL || 'gemini-2.5-flash';
const MEAL_SCAN_LIMITS = {
    free: Number(process.env.FREE_MEAL_SCAN_LIMIT ?? 0),
    pro: Number(process.env.PRO_MEAL_SCAN_LIMIT ?? 30),
    elite: Number(process.env.ELITE_MEAL_SCAN_LIMIT ?? 90)
};
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'gemini-2.5-pro';
const PROTEIN_TARGET_GRAMS = Number(process.env.PROTEIN_TARGET_GRAMS ?? 100);

const normalizeLanguage = (value) => {
    const normalized = String(value || '').toLowerCase();
    return ['en', 'fr', 'es'].includes(normalized) ? normalized : 'en';
};

const mapPerformanceRow = (row = {}) => ({
    id: row.id,
    exercise: row.exercise,
    load: Number(row.load) || 0,
    reps: Number(row.reps) || 0,
    unit: row.unit || 'kg',
    rpe: row.rpe !== undefined && row.rpe !== null ? Number(row.rpe) : null,
    notes: row.notes || null,
    performedAt: row.performedAt,
    createdAt: row.createdAt
});

const PERFORMANCE_RANGE_DAYS = {
    week: 7,
    month: 30,
    year: 365
};

const getRangeStartDate = (range = 'month') => {
    const days = PERFORMANCE_RANGE_DAYS[range] || PERFORMANCE_RANGE_DAYS.month;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    return start.toISOString();
};

const getWeeklySummaryStats = async (userId) => {
    const now = new Date();
    const startCurrent = new Date(now);
    startCurrent.setHours(0, 0, 0, 0);
    startCurrent.setDate(startCurrent.getDate() - 6);
    const startPrev = new Date(startCurrent);
    startPrev.setDate(startPrev.getDate() - 7);

    const [performanceRows, mealScans] = await Promise.all([
        getPerformanceEntriesSince(userId, startPrev.toISOString()),
        getMealScansSince(userId, startCurrent.toISOString())
    ]);

    const currentPerf = performanceRows.filter(row => new Date(row.performedAt) >= startCurrent);
    const previousPerf = performanceRows.filter(row => new Date(row.performedAt) < startCurrent);

    const sumVolume = (entries) => entries.reduce((sum, row) => sum + row.load * row.reps, 0);
    const currentVolume = sumVolume(currentPerf);
    const previousVolume = sumVolume(previousPerf);

    const bestLiftDiff = (() => {
        const mapByExercise = (rows) => {
            const map = new Map();
            rows.forEach(row => {
                const best = map.get(row.exercise) || 0;
                if (row.load > best) map.set(row.exercise, row.load);
            });
            return map;
        };
        const currentMap = mapByExercise(currentPerf);
        const prevMap = mapByExercise(previousPerf);
        let topExercise = null;
        let delta = 0;
        currentMap.forEach((value, key) => {
            const diff = value - (prevMap.get(key) || 0);
            if (diff > delta) {
                delta = diff;
                topExercise = key;
            }
        });
        return { exercise: topExercise, delta };
    })();

    const proteinWarnings = mealScans.reduce((count, scan) => {
        const protein = Number(scan?.macros?.proteinGrams || 0);
        return protein < PROTEIN_TARGET_GRAMS ? count + 1 : count;
    }, 0);
    const avgCalories = mealScans.length
        ? mealScans.reduce((sum, scan) => sum + Number(scan.totalCalories || 0), 0) / mealScans.length
        : 0;

    return {
        periodStart: startCurrent.toISOString(),
        performance: {
            sessions: currentPerf.length,
            volume: currentVolume,
            previousVolume,
            volumeDelta: currentVolume - previousVolume,
            bestLiftDelta: bestLiftDiff
        },
        nutrition: {
            scans: mealScans.length,
            avgCalories,
            proteinWarnings,
            proteinTarget: PROTEIN_TARGET_GRAMS
        }
    };
};

const getMealScanLimitForTier = (tier = 'free') => {
    const value = MEAL_SCAN_LIMITS[tier] ?? 0;
    return Number.isFinite(value) ? value : 0;
};

const getMealScanUsage = (userId) => {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM meal_scans WHERE user_id = ? AND datetime(createdAt) >= datetime(?)', [userId, start.toISOString()], (err, row) => {
            if (err) return reject(err);
            resolve(row?.count || 0);
        });
    });
};

const buildMealScanPrompt = (notes = '', language = 'en') => `
You are an experienced sports dietitian. Analyze the provided meal photo and estimate:
- Total calories and a reasonable range.
- Macro breakdown in grams (protein, carbohydrates, fats).
- Key ingredients with portion estimates.
- Optional coaching recommendations.

Constraints:
- If visibility is limited, mention assumptions and reduce confidence.
- Assume the meal serves one person unless notes mention otherwise.
- Always respond in ${language}.
- If the image is unclear or not food, explain why analysis isn't possible.

Additional user notes: ${notes || 'None provided.'}
Return ONLY valid JSON.
`;

const mealScanResponseSchema = {
    type: 'object',
    properties: {
        totalCalories: { type: 'integer' },
        caloriesRange: {
            type: 'object',
            nullable: true,
            properties: {
                min: { type: 'integer' },
                max: { type: 'integer' }
            },
            required: ['min', 'max']
        },
        macros: {
            type: 'object',
            properties: {
                proteinGrams: { type: 'number' },
                carbsGrams: { type: 'number' },
                fatGrams: { type: 'number' }
            },
            required: ['proteinGrams', 'carbsGrams', 'fatGrams']
        },
        ingredients: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    estimatedPortion: { type: 'string' },
                    macroRole: { type: 'string', nullable: true }
                },
                required: ['name', 'estimatedPortion']
            }
        },
        confidence: { type: 'string' },
        notes: { type: 'string', nullable: true },
        recommendations: { type: 'string', nullable: true }
    },
    required: ['totalCalories', 'macros', 'ingredients', 'confidence']
};

const performMealScan = async (imageBase64, notes = '', language = 'en') => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key is not configured.');
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mealScanModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: imageBase64
                            }
                        },
                        { text: buildMealScanPrompt(notes, language) }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: mealScanResponseSchema
            }
        })
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${errText}`);
    }
    const payload = await response.json();
    const textPayload = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textPayload) {
        throw new Error('Gemini API returned an empty response.');
    }
    try {
        return JSON.parse(textPayload);
    } catch (err) {
        console.error('Failed to parse meal scan JSON:', err, textPayload);
        throw new Error('AI response could not be parsed.');
    }
};

const generateWeeklySummary = async (stats, language = 'en') => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key is not configured.');
    const prompt = buildWeeklySummaryPrompt(stats, language);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${SUMMARY_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'text/plain'
            }
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini summary error: ${text}`);
    }
    const payload = await response.json();
    const summary = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) throw new Error('Summary generation returned empty text.');
    return summary.trim();
};

const getPerformanceEntriesSince = (userId, startIso) => new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM performance_logs WHERE user_id = ? AND datetime(performedAt) >= datetime(?) ORDER BY datetime(performedAt) ASC';
    db.all(sql, [userId, startIso], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(mapPerformanceRow));
    });
});

const getMealScansSince = (userId, startIso) => new Promise((resolve, reject) => {
    const sql = 'SELECT result_json, createdAt FROM meal_scans WHERE user_id = ? AND datetime(createdAt) >= datetime(?) ORDER BY datetime(createdAt) ASC';
    db.all(sql, [userId, startIso], (err, rows) => {
        if (err) return reject(err);
        const items = (rows || []).map(row => {
            let payload = {};
            try {
                payload = JSON.parse(row.result_json);
            } catch (e) {
                payload = {};
            }
            return { ...payload, createdAt: row.createdAt };
        });
        resolve(items);
    });
});

const buildWeeklySummaryPrompt = (stats, language = 'en') => `You are a concise fitness and nutrition coach. Based on the data below, produce a short weekly recap with 2 bullet points for training and 2 for nutrition. Highlight progress, warn about regressions, and recommend the next focus.
All output must be in ${language}. Do not invent numbers beyond those provided.

DATA:
${JSON.stringify(stats, null, 2)}
`;

const fetchMealPlanForUser = (planId, userId, callback) => {
    const sql = 'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?';
    db.get(sql, [planId, userId], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(new Error('Meal plan not found'));
        callback(null, row);
    });
};

const defaultToolState = {
    hydration: { targetMl: 2500, consumedMl: 0 },
    stopwatch: { elapsedMs: 0, running: false, updatedAt: null },
    boxing: {
        roundLength: 180,
        restLength: 60,
        rounds: 3,
        currentRound: 1,
        phase: 'round',
        timeLeft: 180,
        running: false,
        updatedAt: null
    }
};

const sanitizeToolState = (payload = {}) => {
    const hydration = payload.hydration || {};
    const stopwatch = payload.stopwatch || {};
    const boxing = payload.boxing || {};

    const sanitizedHydration = {
        targetMl: clamp(Number(hydration.targetMl ?? defaultToolState.hydration.targetMl), 500, 5000),
        consumedMl: clamp(Number(hydration.consumedMl ?? defaultToolState.hydration.consumedMl), 0, 10000)
    };

    const sanitizedStopwatch = {
        elapsedMs: clamp(Number(stopwatch.elapsedMs ?? defaultToolState.stopwatch.elapsedMs), 0, 1000 * 60 * 60 * 10),
        running: Boolean(stopwatch.running),
        updatedAt: stopwatch.running ? (stopwatch.updatedAt || new Date().toISOString()) : null
    };

    const sanitizedBoxing = {
        roundLength: clamp(Number(boxing.roundLength ?? defaultToolState.boxing.roundLength), 10, 900),
        restLength: clamp(Number(boxing.restLength ?? defaultToolState.boxing.restLength), 0, 600),
        rounds: clamp(Number(boxing.rounds ?? defaultToolState.boxing.rounds), 1, 20),
        currentRound: clamp(Number(boxing.currentRound ?? defaultToolState.boxing.currentRound), 1, 20),
        phase: boxing.phase === 'rest' ? 'rest' : 'round',
        timeLeft: clamp(Number(boxing.timeLeft ?? defaultToolState.boxing.timeLeft), 0, 1800),
        running: Boolean(boxing.running),
        updatedAt: boxing.running ? (boxing.updatedAt || new Date().toISOString()) : null
    };

    return {
        hydration: sanitizedHydration,
        stopwatch: sanitizedStopwatch,
        boxing: sanitizedBoxing
    };
};

const adjustStopwatchState = (state) => {
    if (!state.running || !state.updatedAt) return state;
    const lastUpdate = new Date(state.updatedAt);
    if (Number.isNaN(lastUpdate.getTime())) return state;
    const delta = Date.now() - lastUpdate.getTime();
    return {
        ...state,
        elapsedMs: state.elapsedMs + delta,
    };
};

const advanceBoxingPhase = (state) => {
    if (state.phase === 'round') {
        if (state.restLength > 0) {
            return { ...state, phase: 'rest', timeLeft: state.restLength };
        }
        return { ...state, phase: 'rest', timeLeft: 0 };
    }
    if (state.currentRound >= state.rounds) {
        return { ...state, running: false, timeLeft: 0 };
    }
    return {
        ...state,
        currentRound: state.currentRound + 1,
        phase: 'round',
        timeLeft: state.roundLength,
    };
};

const adjustBoxingState = (state) => {
    if (!state.running || !state.updatedAt) return state;
    const lastUpdate = new Date(state.updatedAt);
    if (Number.isNaN(lastUpdate.getTime())) return state;
    let delta = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (delta <= 0) return state;
    let updatedState = { ...state };
    while (delta > 0 && updatedState.running) {
        if (delta < updatedState.timeLeft) {
            updatedState.timeLeft -= delta;
            delta = 0;
        } else {
            delta -= updatedState.timeLeft;
            updatedState = advanceBoxingPhase(updatedState);
            if (!updatedState.running) break;
            if (updatedState.timeLeft === 0) {
                updatedState = advanceBoxingPhase(updatedState);
            }
        }
    }
    return updatedState;
};

const adjustToolState = (state) => ({
    hydration: state.hydration,
    stopwatch: adjustStopwatchState(state.stopwatch),
    boxing: adjustBoxingState(state.boxing)
});

const getToolStateForUser = (userId, callback) => {
    db.get('SELECT data_json FROM user_tool_states WHERE user_id = ?', [userId], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(null, defaultToolState);
        try {
            const parsed = JSON.parse(row.data_json);
            const sanitized = sanitizeToolState(parsed);
            callback(null, adjustToolState(sanitized));
        } catch (e) {
            callback(null, defaultToolState);
        }
    });
};

const runQuery = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

const runGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

const recordAdminLog = (adminEmail, action, payload = {}) => {
    if (!adminEmail) return;
    const sql = `INSERT INTO admin_logs (admin_email, action, payload_json, createdAt) VALUES (?, ?, ?, ?)`;
    db.run(sql, [adminEmail, action, JSON.stringify(payload), new Date().toISOString()], (err) => {
        if (err) console.error('Failed to record admin log', err.message);
    });
};

const normalizeNumberInput = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
};

const createRandomPassword = () => crypto.randomBytes(32).toString('hex');

const fetchSharedPlan = (token, callback) => {
    const sql = `SELECT sl.*, wp.plan_name, wp.plan_data_json FROM share_links sl
                 JOIN workout_plans wp ON wp.id = sl.plan_id
                 WHERE sl.token = ?`;
    db.get(sql, [token], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(new Error('Share not found'));
        callback(null, row);
    });
};

const fetchSharedMealPlan = (token, callback) => {
    const sql = `SELECT sl.*, mp.plan_name, mp.plan_data_json FROM meal_share_links sl
                 JOIN meal_plans mp ON mp.id = sl.plan_id
                 WHERE sl.token = ?`;
    db.get(sql, [token], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(new Error('Share not found'));
        callback(null, row);
    });
};

const isShareExpired = (expiresAt) => {
    if (!expiresAt) return true;
    const expires = new Date(expiresAt);
    if (Number.isNaN(expires.getTime())) return true;
    return expires.getTime() < Date.now();
};

if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    console.warn('Warning: dist/index.html not found. Run "npm run build" before starting the server for production.');
}

// --- Middleware ---

app.use(cors({
    origin: '*', // In production, you should restrict this to your frontend's domain
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(session({
    secret: 'a-very-secret-key-that-should-be-in-env-vars',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
app.use('/i18n', express.static(localesDir));

app.get('/share/:token', (req, res) => {
    const token = req.params.token;
    fetchSharedPlan(token, (err, row) => {
        if (err || !row) {
            return res.status(404).send('<h1>Plan not found</h1>');
        }
        if (isShareExpired(row.expiresAt)) {
            return res.status(410).send('<h1>Link expired</h1>');
        }
        let planData;
        try {
            planData = JSON.parse(row.plan_data_json);
        } catch (parseErr) {
            planData = {};
        }
        const planDetails = planData?.planDetails || [];
        const safeTitle = (planData?.planName || row.plan_name || 'Shared Plan').replace(/</g, '&lt;');
        const rowsHtml = planDetails.map(day => {
            const exercises = (day.exercises || []).map(ex => `
                <tr>
                    <td>${ex.name || ''}</td>
                    <td>${ex.sets || ''}</td>
                    <td>${ex.reps || ''}</td>
                    <td>${ex.rest || ''}</td>
                </tr>`).join('');
            return `
                <section>
                    <h3>Day ${day.day || ''} – ${day.focus || ''}</h3>
                    ${exercises ? `<table><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead><tbody>${exercises}</tbody></table>` : '<p>Rest day</p>'}
                </section>`;
        }).join('');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
body { font-family: Arial, sans-serif; background:#0f172a; color:#e2e8f0; margin:0; padding:20px; }
.card { max-width: 800px; margin:0 auto; background:#111827; padding:24px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.4); }
section { margin-bottom:24px; }
table { width:100%; border-collapse:collapse; margin-top:12px; }
th, td { border:1px solid #1f2937; padding:8px; text-align:left; }
th { background:#1f2937; }
</style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${planData?.durationWeeks || ''} weeks • ${planData?.daysPerWeek || ''} days/week</p>
    ${rowsHtml || '<p>No details available.</p>'}
  </div>
</body>
</html>`);
    });
});

app.get('/meal-share/:token', (req, res) => {
    const token = req.params.token;
    fetchSharedMealPlan(token, (err, row) => {
        if (err || !row) {
            return res.status(404).send('<h1>Meal plan not found</h1>');
        }
        if (isShareExpired(row.expiresAt)) {
            return res.status(410).send('<h1>Link expired</h1>');
        }
        let planData;
        try {
            planData = JSON.parse(row.plan_data_json);
        } catch (parseErr) {
            planData = {};
        }
        const escapeHtml = (value = '') => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const planDays = Array.isArray(planData?.days) ? planData.days : [];
        const safeTitle = escapeHtml(planData?.planName || row.plan_name || 'Shared Meal Plan');
        const planSummary = `${planData?.caloriesPerDay || ''} kcal · ${planData?.mealFrequency || ''} meals/day`;
        const rowsHtml = planDays.map(day => {
            const meals = Array.isArray(day.meals) ? day.meals : [];
            const mealsHtml = meals.map(meal => `
                <li>
                    <div class="meal-header">
                        <strong>${escapeHtml(meal.name || '')}</strong>
                        <span>${escapeHtml(meal.calories ? `${meal.calories} kcal` : '')}</span>
                    </div>
                    <p>${escapeHtml(meal.description || '')}</p>
                    ${meal.macros ? `<p class="muted">${escapeHtml(meal.macros)}</p>` : ''}
                    ${meal.recipeTips ? `<p class="tip">${escapeHtml(meal.recipeTips)}</p>` : ''}
                </li>
            `).join('');
            return `
                <section>
                    <h3>${escapeHtml(day.day || '')}</h3>
                    ${day.summary ? `<p>${escapeHtml(day.summary)}</p>` : ''}
                    <ul>${mealsHtml}</ul>
                </section>`;
        }).join('');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #06090f; color: #e2e8f0; margin: 0; padding: 24px; }
h1 { color: #fff; }
section { background: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; margin-bottom: 16px; }
ul { list-style: none; padding-left: 0; }
li { border-bottom: 1px solid rgba(255,255,255,0.05); padding: 12px 0; }
li:last-child { border-bottom: none; }
.muted { color: #94a3b8; font-size: 0.9rem; }
.tip { color: #34d399; font-size: 0.9rem; }
.meal-header { display: flex; justify-content: space-between; font-size: 0.95rem; }
@media (max-width: 600px) { body { padding: 16px; } }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
<p>${escapeHtml(planSummary)}</p>
${rowsHtml}
</body>
</html>`);
    });
});
app.use(express.static(staticDir));

// --- Auth Middleware ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && isAdminEmail(req.session.user.email)) {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required.' });
    }
};

// --- API Routes ---

// Auth
app.post('/api/signup', async (req, res) => {
    const { email, password, firstName, birthDate, heightCm, weightKg, sex } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: 'Invalid input.' });
    }

    if (!firstName || !birthDate) {
        return res.status(400).json({ message: 'Profile information is required.' });
    }

    if (!['male', 'female'].includes((sex || '').toLowerCase())) {
        return res.status(400).json({ message: 'Sex is required.' });
    }

    const normalizedSex = sex.toLowerCase();

    const normalizedHeight = normalizeNumberInput(heightCm);
    const normalizedWeight = normalizeNumberInput(weightKg);

    if (Number.isNaN(normalizedHeight) || Number.isNaN(normalizedWeight)) {
        return res.status(400).json({ message: 'Height and weight must be valid numbers.' });
    }

    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (row) return res.status(409).json({ message: 'User already exists.' });

        try {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const sql = `INSERT INTO users (email, password_hash, subscription_tier, first_name, birth_date, height_cm, weight_kg, sex, created_at)
                         VALUES (?, ?, 'free', ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [email, hashedPassword, firstName, birthDate, normalizedHeight, normalizedWeight, normalizedSex, new Date().toISOString()], function(err) {
                if (err) return res.status(500).json({ message: 'Server error during signup.' });

                const userPayload = {
                    id: this.lastID,
                    email,
                    subscriptionTier: 'free',
                    firstName,
                    birthDate,
                    heightCm: normalizedHeight,
                    weightKg: normalizedWeight,
                    sex: normalizedSex
                };
                req.session.user = userPayload;
                res.status(201).json({ message: 'User created.', user: userPayload });
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error during hashing.' });
        }
    });
});

app.post('/api/signin', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const userPayload = mapUserRow(user);
        req.session.user = userPayload;
        res.status(200).json({ message: 'Signed in.', user: userPayload });
    });
});

app.post('/api/signout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Could not sign out.' });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Signed out.' });
    });
});

app.get('/api/config/genai', isAuthenticated, (req, res) => {
    const browserKey = process.env.PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!browserKey) {
        return res.status(500).json({ message: 'Gemini API key is not configured.' });
    }
    res.status(200).json({ apiKey: browserKey });
});

const CHAT_DEFAULT_TITLE = 'New Chat';
const buildChatTitle = (hint) => {
    if (!hint || !hint.trim()) {
        return `${CHAT_DEFAULT_TITLE} ${new Date().toLocaleDateString()}`;
    }
    return hint.trim().slice(0, 60);
};

const verifySessionOwnership = (sessionId, userId, callback) => {
    const sql = 'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?';
    db.get(sql, [sessionId, userId], (err, session) => {
        if (err) return callback(err);
        if (!session) return callback(new Error('Session not found'));
        callback(null, session);
    });
};

app.get('/api/chat/sessions', isAuthenticated, (req, res) => {
    const sql = `
        SELECT
            s.id,
            s.title,
            s.createdAt,
            s.updatedAt,
            (SELECT content FROM chat_messages m WHERE m.session_id = s.id ORDER BY datetime(m.createdAt) DESC LIMIT 1) AS lastMessage
        FROM chat_sessions s
        WHERE s.user_id = ?
        ORDER BY datetime(s.updatedAt) DESC
    `;
    db.all(sql, [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json({ sessions: rows || [] });
    });
});

app.post('/api/chat/sessions', isAuthenticated, (req, res) => {
    const titleInput = typeof req.body?.title === 'string' ? req.body.title : '';
    const title = titleInput.trim() || `${CHAT_DEFAULT_TITLE} ${new Date().toLocaleDateString()}`;
    const now = new Date().toISOString();
    const sql = `INSERT INTO chat_sessions (user_id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)`;
    db.run(sql, [req.session.user.id, title, now, now], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(201).json({ id: this.lastID, title, createdAt: now, updatedAt: now });
    });
});

app.delete('/api/chat/sessions/:id', isAuthenticated, (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId)) {
        return res.status(400).json({ message: 'Invalid session id.' });
    }
    verifySessionOwnership(sessionId, req.session.user.id, (verifyErr) => {
        if (verifyErr) return res.status(404).json({ message: 'Session not found.' });
        db.run('DELETE FROM chat_messages WHERE session_id = ?', [sessionId], (deleteMessagesErr) => {
            if (deleteMessagesErr) return res.status(500).json({ message: 'Database error.' });
            db.run('DELETE FROM chat_sessions WHERE id = ?', [sessionId], (deleteSessionErr) => {
                if (deleteSessionErr) return res.status(500).json({ message: 'Database error.' });
                res.status(200).json({ message: 'Chat session deleted.' });
            });
        });
    });
});

app.get('/api/chat/sessions/:id/messages', isAuthenticated, (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId)) {
        return res.status(400).json({ message: 'Invalid session id.' });
    }
    verifySessionOwnership(sessionId, req.session.user.id, (verifyErr) => {
        if (verifyErr) return res.status(404).json({ message: 'Session not found.' });
        db.all('SELECT id, role, content, createdAt FROM chat_messages WHERE session_id = ? ORDER BY datetime(createdAt) ASC', [sessionId], (err, rows) => {
            if (err) return res.status(500).json({ message: 'Database error.' });
            res.status(200).json({ messages: rows || [] });
        });
    });
});

app.post('/api/chat/sessions/:id/messages', isAuthenticated, (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId)) {
        return res.status(400).json({ message: 'Invalid session id.' });
    }
    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!incoming.length) {
        return res.status(400).json({ message: 'No messages provided.' });
    }
    verifySessionOwnership(sessionId, req.session.user.id, (verifyErr, session) => {
        if (verifyErr) return res.status(404).json({ message: 'Session not found.' });
        const now = new Date().toISOString();
        const stmt = db.prepare('INSERT INTO chat_messages (session_id, role, content, createdAt) VALUES (?, ?, ?, ?)');
        incoming.forEach(msg => {
            if (!msg?.role || !msg?.content) return;
            const role = msg.role === 'model' ? 'model' : 'user';
            stmt.run(sessionId, role, String(msg.content), new Date().toISOString());
        });
        stmt.finalize((finalizeErr) => {
            if (finalizeErr) return res.status(500).json({ message: 'Database error.' });
            const titleHint = typeof req.body?.titleHint === 'string' ? req.body.titleHint.trim() : '';
            const updates = [];
            const params = [];
            if (titleHint && (!session.title || session.title.startsWith(CHAT_DEFAULT_TITLE))) {
                updates.push('title = ?');
                params.push(buildChatTitle(titleHint));
            }
            updates.push('updatedAt = ?');
            params.push(now, sessionId);
            const updateSql = `UPDATE chat_sessions SET ${updates.join(', ')} WHERE id = ?`;
            db.run(updateSql, params, (updateErr) => {
                if (updateErr) return res.status(500).json({ message: 'Database error.' });
                res.status(200).json({ message: 'Messages saved.', updatedAt: now });
            });
        });
    });
});

app.post('/api/auth/google', async (req, res) => {
    if (!googleClient) {
        return res.status(500).json({ message: 'Google auth is not configured.' });
    }
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ message: 'Missing Google credential.' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
        const payload = ticket.getPayload();
        const email = payload?.email;
        if (!email) {
            return res.status(400).json({ message: 'Google response did not include an email.' });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (err) return res.status(500).json({ message: 'Database error.' });

            const respondWithUser = (userRow) => {
                const userPayload = mapUserRow(userRow);
                req.session.user = userPayload;
                res.status(200).json({ user: userPayload });
            };

            if (existingUser) {
                return respondWithUser(existingUser);
            }

            try {
                const randomPassword = createRandomPassword();
                const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);
                const firstName = payload?.given_name || payload?.name || email.split('@')[0];
                const sql = `INSERT INTO users (email, password_hash, subscription_tier, first_name, birth_date, height_cm, weight_kg, created_at)
                             VALUES (?, ?, 'free', ?, ?, ?, ?, ?)`;
                db.run(sql, [email, hashedPassword, firstName, null, null, null, new Date().toISOString()], function(insertErr) {
                    if (insertErr) return res.status(500).json({ message: 'Server error during Google signup.' });
                    db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (fetchErr, newUser) => {
                        if (fetchErr || !newUser) return res.status(500).json({ message: 'Could not load new user.' });
                        respondWithUser(newUser);
                    });
                });
            } catch (hashErr) {
                console.error('Failed to create Google account', hashErr);
                res.status(500).json({ message: 'Could not create account from Google profile.' });
            }
        });
    } catch (err) {
        console.error('Google auth failed', err);
        res.status(401).json({ message: 'Invalid Google credential.' });
    }
});

app.get('/api/auth/check', (req, res) => {
    if (req.session.user) {
        // Refresh user data from DB in case it changed (e.g., subscription)
        db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
            if(err || !user) {
                 req.session.destroy();
                 return res.status(200).json({ isAuthenticated: false });
            }
            const userPayload = mapUserRow(user);
            req.session.user = userPayload;
            res.status(200).json({ isAuthenticated: true, user: userPayload });
        });
    } else {
        res.status(200).json({ isAuthenticated: false });
    }
});


// Analysis
app.post('/api/analysis', isAuthenticated, (req, res) => {
    const { type, exerciseName, prompt, result, imageBase64, poseDataJson } = req.body;
    if (!type || !result) {
        return res.status(400).json({ message: 'Missing required data.' });
    }
    const sql = `INSERT INTO analyses (user_id, type, exerciseName, prompt, result, imageBase64, createdAt, pose_data_json) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [req.session.user.id, type, exerciseName, prompt, result, imageBase64, new Date().toISOString(), poseDataJson];
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(201).json({ message: 'Analysis saved.' });
    });
});

app.get('/api/analysis', isAuthenticated, (req, res) => {
    const sql = "SELECT * FROM analyses WHERE user_id = ? ORDER BY createdAt DESC";
    db.all(sql, [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json(rows);
    });
});

app.get('/api/analysis/stats', isAuthenticated, (req, res) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const sql = `SELECT type, COUNT(*) as count FROM analyses WHERE user_id = ? AND createdAt >= ? GROUP BY type`;

    db.all(sql, [req.session.user.id, oneMonthAgo.toISOString()], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        
        const stats = {
            video: rows.find(r => r.type === 'video')?.count || 0,
            image: rows.find(r => r.type === 'image')?.count || 0,
        };
        res.status(200).json(stats);
    });
});

app.get('/api/tools/state', isAuthenticated, (req, res) => {
    getToolStateForUser(req.session.user.id, (err, state) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json(state);
    });
});

app.put('/api/tools/state', isAuthenticated, (req, res) => {
    const sanitized = sanitizeToolState(req.body || {});
    const sql = `INSERT INTO user_tool_states (user_id, data_json, updatedAt)
                 VALUES (?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updatedAt = excluded.updatedAt`;
    db.run(sql, [req.session.user.id, JSON.stringify(sanitized), new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json({ message: 'Tool state saved.' });
    });
});

app.get('/api/admin/users', isAuthenticated, isAdmin, (req, res) => {
    const sql = `
        SELECT
            u.id,
            u.email,
            u.subscription_tier,
            u.first_name,
            u.birth_date,
            u.height_cm,
            u.weight_kg,
            (SELECT COUNT(*) FROM analyses a WHERE a.user_id = u.id) AS analysis_count,
            (SELECT COUNT(*) FROM workout_plans w WHERE w.user_id = u.id) AS plan_count,
            (SELECT COUNT(*) FROM goals g WHERE g.user_id = u.id AND g.completed = 1) AS goals_completed
        FROM users u
        ORDER BY u.id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const users = rows.map(row => ({
            id: row.id,
            email: row.email,
            subscriptionTier: row.subscription_tier,
            firstName: row.first_name,
            birthDate: row.birth_date,
            heightCm: row.height_cm,
            weightKg: row.weight_kg,
            analysisCount: row.analysis_count,
            planCount: row.plan_count,
            goalsCompleted: row.goals_completed,
            isAdmin: isAdminEmail(row.email)
        }));
        res.status(200).json(users);
    });
});

app.post('/api/admin/users/bulk', isAuthenticated, isAdmin, (req, res) => {
    const { userIds = [], action, tier } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'userIds array required.' });
    }
    const ids = userIds.map((id) => Number(id)).filter(id => Number.isFinite(id));
    if (!ids.length) {
        return res.status(400).json({ message: 'No valid user ids.' });
    }
    const placeholders = ids.map(() => '?').join(',');
    const adminEmail = req.session.user.email;

    const finalize = (message) => {
        recordAdminLog(adminEmail, `bulk_${action}`, { userIds: ids, tier });
        res.status(200).json({ message });
    };

    if (action === 'setTier') {
        if (!['free', 'pro', 'elite'].includes(tier)) {
            return res.status(400).json({ message: 'Invalid tier for bulk update.' });
        }
        const sql = `UPDATE users SET subscription_tier = ? WHERE id IN (${placeholders})`;
        db.run(sql, [tier, ...ids], function(err) {
            if (err) return res.status(500).json({ message: 'Database error.' });
            if (ids.includes(req.session.user.id)) {
                req.session.user.subscriptionTier = tier;
            }
            finalize('Subscriptions updated.');
        });
    } else if (action === 'resetTools') {
        const sql = `DELETE FROM user_tool_states WHERE user_id IN (${placeholders})`;
        db.run(sql, ids, function(err) {
            if (err) return res.status(500).json({ message: 'Database error.' });
            finalize('Tool states reset.');
        });
    } else if (action === 'notify') {
        finalize('Notification logged.');
    } else {
        res.status(400).json({ message: 'Unknown bulk action.' });
    }
});

app.get('/api/admin/users/:id/details', isAuthenticated, isAdmin, (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: 'Invalid user id.' });
    }

    const queries = {
        analyses: `SELECT id, type, exerciseName, prompt, createdAt FROM analyses WHERE user_id = ? ORDER BY datetime(createdAt) DESC LIMIT 5`,
        plans: `SELECT id, plan_name, createdAt FROM workout_plans WHERE user_id = ? ORDER BY datetime(createdAt) DESC LIMIT 5`,
        goals: `SELECT id, text, completed, createdAt FROM goals WHERE user_id = ? ORDER BY datetime(createdAt) DESC LIMIT 5`
    };

    const response = {};

    db.all(queries.analyses, [userId], (analysisErr, analysisRows) => {
        if (analysisErr) return res.status(500).json({ message: 'Database error.' });
        response.analyses = analysisRows || [];

        db.all(queries.plans, [userId], (planErr, planRows) => {
            if (planErr) return res.status(500).json({ message: 'Database error.' });
            response.plans = planRows || [];

            db.all(queries.goals, [userId], (goalErr, goalRows) => {
                if (goalErr) return res.status(500).json({ message: 'Database error.' });
                response.goals = goalRows || [];
                res.status(200).json(response);
            });
        });
    });
});

app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const [userRow, analysisRow, planRow, goalRow, topRows] = await Promise.all([
            runGet('SELECT COUNT(*) as count FROM users'),
            runGet('SELECT COUNT(*) as count FROM analyses'),
            runGet('SELECT COUNT(*) as count FROM workout_plans'),
            runGet('SELECT COUNT(*) as count FROM goals WHERE completed = 1'),
            runQuery(`SELECT u.email, COUNT(a.id) as analyses
                      FROM users u
                      LEFT JOIN analyses a ON a.user_id = u.id
                      GROUP BY u.id
                      ORDER BY analyses DESC
                      LIMIT 5`)
        ]);
        const totalUsers = userRow?.count || 0;
        const totalAnalyses = analysisRow?.count || 0;
        const totalPlans = planRow?.count || 0;
        const totalGoalsCompleted = goalRow?.count || 0;
        const xpTotal = totalAnalyses * 10 + totalPlans * 15 + totalGoalsCompleted * 5;
        const avgXp = totalUsers ? Math.round(xpTotal / totalUsers) : 0;
        res.status(200).json({
            totalUsers,
            totalAnalyses,
            totalPlans,
            totalGoalsCompleted,
            avgXp,
            topUsers: topRows || []
        });
    } catch (err) {
        console.error('Failed to compute stats', err);
        res.status(500).json({ message: 'Could not compute stats.' });
    }
});

app.get('/api/admin/metrics', isAuthenticated, isAdmin, async (req, res) => {
    const rangeParam = parseInt(req.query.range, 10);
    const range = Math.min(Math.max(rangeParam || 14, 7), 90);
    const since = new Date();
    since.setDate(since.getDate() - (range - 1));
    const sinceIso = since.toISOString();
    try {
        const [analysisRows, signupRows] = await Promise.all([
            runQuery(`SELECT DATE(createdAt) as day, COUNT(*) as count FROM analyses WHERE datetime(createdAt) >= datetime(?) GROUP BY day`, [sinceIso]),
            runQuery(`SELECT DATE(created_at) as day, COUNT(*) as count FROM users WHERE datetime(created_at) >= datetime(?) GROUP BY day`, [sinceIso])
        ]);
        const dayKeys = [];
        for (let i = 0; i < range; i++) {
            const d = new Date(since);
            d.setDate(since.getDate() + i);
            dayKeys.push(d.toISOString().split('T')[0]);
        }
        const mapRows = (rows = []) => {
            const map = new Map();
            rows.forEach(row => map.set(row.day, row.count));
            return dayKeys.map(day => ({
                day,
                label: new Date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                count: map.get(day) || 0
            }));
        };
        res.status(200).json({
            range,
            analysisSeries: mapRows(analysisRows),
            signupSeries: mapRows(signupRows)
        });
    } catch (err) {
        console.error('Failed to compute metrics', err);
        res.status(500).json({ message: 'Could not compute metrics.' });
    }
});

app.get('/api/admin/logs', isAuthenticated, isAdmin, (req, res) => {
    db.all('SELECT * FROM admin_logs ORDER BY datetime(createdAt) DESC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json(rows || []);
    });
});

app.get('/api/cms', (req, res) => {
    db.all('SELECT key, value FROM cms_entries', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const entries = {};
        (rows || []).forEach(row => { entries[row.key] = row.value; });
        res.status(200).json({ entries });
    });
});

app.get('/api/admin/cms', isAuthenticated, isAdmin, (req, res) => {
    db.all('SELECT key, value, updatedBy, updatedAt FROM cms_entries ORDER BY key ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json({ entries: rows || [] });
    });
});

app.put('/api/admin/cms', isAuthenticated, isAdmin, (req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates) || !updates.length) {
        return res.status(400).json({ message: 'No updates provided.' });
    }
    const stmt = db.prepare(`INSERT INTO cms_entries (key, value, updatedBy, updatedAt)
                             VALUES (?, ?, ?, ?)
                             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedBy = excluded.updatedBy, updatedAt = excluded.updatedAt`);
    updates.forEach(entry => {
        if (entry?.key) {
            stmt.run(entry.key, entry.value ?? '', req.session.user.email, new Date().toISOString());
        }
    });
    stmt.finalize((err) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        recordAdminLog(req.session.user.email, 'cms_update', { keys: updates.map(u => u.key) });
        res.status(200).json({ message: 'CMS updated.' });
    });
});

app.put('/api/admin/users/:id/subscription', isAuthenticated, isAdmin, (req, res) => {
    const { tier } = req.body;
    if (!['free', 'pro', 'elite'].includes(tier)) {
        return res.status(400).json({ message: 'Invalid tier.' });
    }
    const sql = 'UPDATE users SET subscription_tier = ? WHERE id = ?';
    db.run(sql, [tier, req.params.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'User not found.' });
        if (req.session.user.id === Number(req.params.id)) {
            req.session.user.subscriptionTier = tier;
        }
        recordAdminLog(req.session.user.email, 'update_tier', { targetUserId: Number(req.params.id), tier });
        res.status(200).json({ message: 'Subscription updated.' });
    });
});

app.get('/api/gamification', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    db.all('SELECT createdAt FROM analyses WHERE user_id = ?', [userId], (analysisErr, analysisRows) => {
        if (analysisErr) return res.status(500).json({ message: 'Database error.' });

        db.get('SELECT COUNT(*) as count FROM workout_plans WHERE user_id = ?', [userId], (planErr, planRow) => {
            if (planErr) return res.status(500).json({ message: 'Database error.' });

            db.get('SELECT COUNT(*) as count FROM goals WHERE user_id = ? AND completed = 1', [userId], (goalErr, goalRow) => {
                if (goalErr) return res.status(500).json({ message: 'Database error.' });

                const totalAnalyses = analysisRows.length;
                const now = new Date();
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 6);
                const weeklyAnalyses = analysisRows.filter(row => {
                    const created = new Date(row.createdAt);
                    return !Number.isNaN(created.getTime()) && created >= weekAgo;
                }).length;

                const dayKeys = analysisRows
                    .map(row => getDateKey(row.createdAt))
                    .filter(Boolean);
                const sortedDays = Array.from(new Set(dayKeys)).sort((a, b) => b.localeCompare(a));
                const streakDays = calculateStreak(sortedDays);
                const lastAnalysisDate = sortedDays.length ? sortedDays[0] : null;

                const plansCreated = planRow?.count || 0;
                const goalsCompleted = goalRow?.count || 0;

                const xp = totalAnalyses * 10 + plansCreated * 15 + goalsCompleted * 5;
                const level = Math.max(1, Math.floor(xp / 100) + 1);
                const nextLevelXp = level * 100;

                const badges = [
                    { id: 'first-analysis', earned: totalAnalyses >= 1 },
                    { id: 'form-apprentice', earned: totalAnalyses >= 5 },
                    { id: 'form-elite', earned: totalAnalyses >= 20 },
                    { id: 'consistency', earned: streakDays >= 3 },
                    { id: 'streak-warrior', earned: streakDays >= 7 },
                    { id: 'weekly-warrior', earned: weeklyAnalyses >= 5 },
                    { id: 'weekly-legend', earned: weeklyAnalyses >= 10 },
                    { id: 'planner', earned: plansCreated >= 1 },
                    { id: 'program-architect', earned: plansCreated >= 5 },
                    { id: 'goal-crusher', earned: goalsCompleted >= 3 },
                    { id: 'goal-champion', earned: goalsCompleted >= 10 },
                    { id: 'xp-hustler', earned: xp >= 500 }
                ];

                res.status(200).json({
                    totalAnalyses,
                    weeklyAnalyses,
                    streakDays,
                    xp,
                    level,
                    nextLevelXp,
                    plansCreated,
                    goalsCompleted,
                    lastAnalysisDate,
                    badges
                });
            });
        });
    });
});


// Goals
app.get('/api/goals', isAuthenticated, (req, res) => {
    db.all('SELECT * FROM goals WHERE user_id = ? ORDER BY createdAt DESC', [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(200).json(rows.map(r => ({...r, completed: !!r.completed})));
    });
});

app.post('/api/goals', isAuthenticated, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Goal text is required.' });

    const sql = 'INSERT INTO goals (user_id, text, createdAt) VALUES (?, ?, ?)';
    db.run(sql, [req.session.user.id, text, new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.status(201).json({ id: this.lastID, text, completed: false });
    });
});

app.put('/api/goals/:id', isAuthenticated, (req, res) => {
    const { completed } = req.body;
    const sql = 'UPDATE goals SET completed = ? WHERE id = ? AND user_id = ?';
    db.run(sql, [completed ? 1 : 0, req.params.id, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Goal not found or unauthorized.' });
        res.status(200).json({ message: 'Goal updated.' });
    });
});

app.delete('/api/goals/:id', isAuthenticated, (req, res) => {
    const sql = 'DELETE FROM goals WHERE id = ? AND user_id = ?';
    db.run(sql, [req.params.id, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Goal not found or unauthorized.' });
        res.status(200).json({ message: 'Goal deleted.' });
    });
});

// Workout Plans
app.post('/api/plans', isAuthenticated, (req, res) => {
    const { planName, planData } = req.body;
    if (!planName || !planData) {
        return res.status(400).json({ message: 'Missing plan name or data.' });
    }
    const sql = 'INSERT INTO workout_plans (user_id, plan_name, plan_data_json, createdAt) VALUES (?, ?, ?, ?)';
    const params = [req.session.user.id, planName, JSON.stringify(planData), new Date().toISOString()];
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ message: 'Database error while saving plan.' });
        res.status(201).json({ message: 'Workout plan saved successfully.', id: this.lastID });
    });
});

app.get('/api/plans', isAuthenticated, (req, res) => {
    const sql = "SELECT * FROM workout_plans WHERE user_id = ? ORDER BY createdAt DESC";
    db.all(sql, [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const plans = rows.map(row => ({
            id: row.id,
            planName: row.plan_name,
            createdAt: row.createdAt,
            ...JSON.parse(row.plan_data_json)
        }));
        res.status(200).json(plans);
    });
});

app.delete('/api/plans/:id', isAuthenticated, (req, res) => {
    const sql = 'DELETE FROM workout_plans WHERE id = ? AND user_id = ?';
    const planId = Number(req.params.id);
    db.run(sql, [planId, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Plan not found or unauthorized.' });
        db.run('DELETE FROM share_links WHERE plan_id = ?', [planId], () => {});
        res.status(200).json({ message: 'Plan deleted.' });
    });
});

app.post('/api/plans/:id/share', isAuthenticated, (req, res) => {
    const planId = Number(req.params.id);
    if (!Number.isFinite(planId)) {
        return res.status(400).json({ message: 'Invalid plan id.' });
    }
    fetchPlanForUser(planId, req.session.user.id, (planErr, planRow) => {
        if (planErr) return res.status(404).json({ message: 'Plan not found.' });
        const expiresInDays = clamp(Number(req.body?.expiresInDays ?? SHARE_DEFAULT_DAYS), 1, 90);
        const token = createShareToken();
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
        const insertSql = 'INSERT INTO share_links (token, plan_id, user_id, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)';
        db.run(insertSql, [token, planRow.id, req.session.user.id, createdAt, expiresAt], (insertErr) => {
            if (insertErr) return res.status(500).json({ message: 'Database error.' });
            res.status(201).json({
                token,
                shareUrl: buildShareUrl(req, token),
                expiresAt
            });
        });
    });
});

app.get('/api/share/:token', (req, res) => {
    const { token } = req.params;
    fetchSharedPlan(token, (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Share link not found.' });
        if (isShareExpired(row.expiresAt)) return res.status(410).json({ message: 'Share link expired.' });
        let planData;
        try {
            planData = JSON.parse(row.plan_data_json);
        } catch (parseErr) {
            planData = {};
        }
        res.status(200).json({
            token,
            planName: row.plan_name,
            plan: planData,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt
        });
    });
});

app.get('/api/meal-share/:token', (req, res) => {
    const { token } = req.params;
    fetchSharedMealPlan(token, (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Share link not found.' });
        if (isShareExpired(row.expiresAt)) return res.status(410).json({ message: 'Share link expired.' });
        let planData;
        try {
            planData = JSON.parse(row.plan_data_json);
        } catch (parseErr) {
            planData = {};
        }
        res.status(200).json({
            token,
            planName: row.plan_name,
            plan: planData,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt
        });
    });
});

// Meal Plans
app.post('/api/meal-plans', isAuthenticated, (req, res) => {
    const { planName, planData } = req.body;
    if (!planName || !planData) {
        return res.status(400).json({ message: 'Missing plan name or data.' });
    }
    const sql = 'INSERT INTO meal_plans (user_id, plan_name, plan_data_json, createdAt) VALUES (?, ?, ?, ?)';
    db.run(sql, [req.session.user.id, planName, JSON.stringify(planData), new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ message: 'Database error while saving meal plan.' });
        res.status(201).json({ message: 'Meal plan saved successfully.', id: this.lastID });
    });
});

app.get('/api/meal-plans', isAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM meal_plans WHERE user_id = ? ORDER BY datetime(createdAt) DESC';
    db.all(sql, [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const plans = (rows || []).map(row => {
            let payload = {};
            try {
                payload = JSON.parse(row.plan_data_json);
            } catch (parseErr) {
                payload = {};
            }
            return {
                id: row.id,
                createdAt: row.createdAt,
                ...payload
            };
        });
        res.status(200).json(plans);
    });
});

app.delete('/api/meal-plans/:id', isAuthenticated, (req, res) => {
    const planId = Number(req.params.id);
    if (!Number.isFinite(planId)) {
        return res.status(400).json({ message: 'Invalid plan id.' });
    }
    const sql = 'DELETE FROM meal_plans WHERE id = ? AND user_id = ?';
    db.run(sql, [planId, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Plan not found or unauthorized.' });
        db.run('DELETE FROM meal_share_links WHERE plan_id = ?', [planId], () => {});
        res.status(200).json({ message: 'Meal plan deleted.' });
    });
});

app.post('/api/meal-plans/:id/share', isAuthenticated, (req, res) => {
    const planId = Number(req.params.id);
    if (!Number.isFinite(planId)) {
        return res.status(400).json({ message: 'Invalid plan id.' });
    }
    fetchMealPlanForUser(planId, req.session.user.id, (planErr, planRow) => {
        if (planErr) return res.status(404).json({ message: 'Plan not found.' });
        const expiresInDays = clamp(Number(req.body?.expiresInDays ?? SHARE_DEFAULT_DAYS), 1, 90);
        const token = createShareToken();
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
        const insertSql = 'INSERT INTO meal_share_links (token, plan_id, user_id, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)';
        db.run(insertSql, [token, planRow.id, req.session.user.id, createdAt, expiresAt], (insertErr) => {
            if (insertErr) return res.status(500).json({ message: 'Database error.' });
            res.status(201).json({
                token,
                shareUrl: buildMealShareUrl(req, token),
                expiresAt
            });
        });
    });
});

app.get('/api/meal-scans/stats', isAuthenticated, async (req, res) => {
    try {
        const used = await getMealScanUsage(req.session.user.id);
        const limitValue = getMealScanLimitForTier(req.session.user.subscriptionTier);
        const limit = limitValue > 0 ? limitValue : null;
        res.status(200).json({ used, limit });
    } catch (err) {
        console.error('Failed to load meal scan stats', err);
        res.status(500).json({ message: 'Could not load scan stats.' });
    }
});

app.get('/api/meal-scans', isAuthenticated, (req, res) => {
    const limit = clamp(Number(req.query.limit || 10), 1, 50);
    const sql = `SELECT id, result_json, image_base64, notes, createdAt FROM meal_scans WHERE user_id = ? ORDER BY datetime(createdAt) DESC LIMIT ?`;
    db.all(sql, [req.session.user.id, limit], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const scans = (rows || []).map(row => {
            let payload = {};
            try {
                payload = JSON.parse(row.result_json);
            } catch (parseErr) {
                payload = {};
            }
            return {
                id: row.id,
                createdAt: row.createdAt,
                userNotes: row.notes,
                ...payload
            };
        });
        res.status(200).json({ scans });
    });
});

app.post('/api/meal-scans', isAuthenticated, async (req, res) => {
    const tier = req.session.user.subscriptionTier || 'free';
    if (tier === 'free') {
        return res.status(403).json({ message: 'Upgrade to Pro or Elite to access meal scans.' });
    }
    const { imageBase64, notes = '', language = 'en' } = req.body || {};
    const normalizedLanguage = normalizeLanguage(language);
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ message: 'Meal photo is required.' });
    }
    if (imageBase64.length > 8 * 1024 * 1024) {
        return res.status(400).json({ message: 'Image is too large. Please upload a smaller photo.' });
    }

    try {
        const limit = getMealScanLimitForTier(tier);
        const used = await getMealScanUsage(req.session.user.id);
        if (limit > 0 && used >= limit) {
            return res.status(429).json({ message: 'You have reached your monthly meal scan limit.' });
        }

        const result = await performMealScan(imageBase64, notes, normalizedLanguage);
        const createdAt = new Date().toISOString();
        const insertSql = `INSERT INTO meal_scans (user_id, result_json, image_base64, notes, createdAt) VALUES (?, ?, ?, ?, ?)`;
        db.run(insertSql, [req.session.user.id, JSON.stringify(result), imageBase64, notes || null, createdAt], function(err) {
            if (err) {
                console.error('Failed to save meal scan', err);
                return res.status(500).json({ message: 'Database error.' });
            }
            res.status(201).json({
                scan: {
                    id: this.lastID,
                    createdAt,
                    userNotes: notes || null,
                    ...result
                }
            });
        });
    } catch (err) {
        console.error('Meal scan failed', err);
        res.status(500).json({ message: err instanceof Error ? err.message : 'Unable to analyze this meal.' });
    }
});

app.get('/api/summary/weekly', isAuthenticated, async (req, res) => {
    if (!['pro', 'elite'].includes(req.session.user.subscriptionTier)) {
        return res.status(403).json({ message: 'Upgrade to Pro or Elite to access weekly summaries.' });
    }
    try {
        const language = normalizeLanguage(req.query.lang || 'en');
        const stats = await getWeeklySummaryStats(req.session.user.id);
        const summary = await generateWeeklySummary(stats, language);
        res.status(200).json({ summary, stats });
    } catch (err) {
        console.error('Weekly summary failed', err);
        res.status(500).json({ message: err instanceof Error ? err.message : 'Summary generation failed.' });
    }
});

app.post('/api/performance', isAuthenticated, (req, res) => {
    const { exercise, load, reps, unit = 'kg', rpe = null, notes = null, performedAt } = req.body || {};
    if (!exercise || !Number.isFinite(Number(load)) || !Number.isFinite(Number(reps))) {
        return res.status(400).json({ message: 'Exercise, load, and reps are required.' });
    }
    const normalizedDate = performedAt ? new Date(performedAt) : new Date();
    if (Number.isNaN(normalizedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date.' });
    }
    const sql = `INSERT INTO performance_logs (user_id, exercise, load, reps, unit, rpe, notes, performedAt, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        req.session.user.id,
        exercise.trim(),
        Number(load),
        Number(reps),
        unit === 'lb' ? 'lb' : 'kg',
        rpe !== null && rpe !== undefined ? Number(rpe) : null,
        notes || null,
        normalizedDate.toISOString(),
        new Date().toISOString()
    ];
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Failed to insert performance log', err);
            return res.status(500).json({ message: 'Database error.' });
        }
        res.status(201).json({ id: this.lastID });
    });
});

app.get('/api/performance', isAuthenticated, (req, res) => {
    const range = ['week', 'month', 'year'].includes(String(req.query.range)) ? String(req.query.range) : 'month';
    const startIso = getRangeStartDate(range);
    const sql = `SELECT * FROM performance_logs WHERE user_id = ? AND datetime(performedAt) >= datetime(?) ORDER BY datetime(performedAt) DESC`;
    db.all(sql, [req.session.user.id, startIso], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const logs = (rows || []).map(mapPerformanceRow);
        res.status(200).json({ logs });
    });
});

app.delete('/api/performance/:id', isAuthenticated, (req, res) => {
    const logId = Number(req.params.id);
    if (!Number.isFinite(logId)) {
        return res.status(400).json({ message: 'Invalid id.' });
    }
    const sql = 'DELETE FROM performance_logs WHERE id = ? AND user_id = ?';
    db.run(sql, [logId, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Entry not found.' });
        res.status(200).json({ message: 'Deleted.' });
    });
});

app.get('/api/performance/analytics', isAuthenticated, (req, res) => {
    const range = ['week', 'month', 'year'].includes(String(req.query.range)) ? String(req.query.range) : 'month';
    const startIso = getRangeStartDate(range);
    const sql = `SELECT * FROM performance_logs WHERE user_id = ? AND datetime(performedAt) >= datetime(?) ORDER BY datetime(performedAt) ASC`;
    db.all(sql, [req.session.user.id, startIso], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        const mappedRows = (rows || []).map(mapPerformanceRow);
        const totalEntries = mappedRows.length;
        let totalVolume = 0;
        let totalLoad = 0;
        let bestLoad = 0;
        const seriesMap = new Map();
        mappedRows.forEach(row => {
            const volume = row.load * row.reps;
            totalVolume += volume;
            totalLoad += row.load;
            bestLoad = Math.max(bestLoad, row.load);
            const label = new Date(row.performedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            seriesMap.set(label, (seriesMap.get(label) || 0) + volume);
        });
        const averageLoad = totalEntries ? totalLoad / totalEntries : 0;
        const series = Array.from(seriesMap.entries()).map(([label, volume]) => ({ label, volume }));
        res.status(200).json({
            analytics: {
                totalEntries,
                totalVolume,
                bestLoad,
                averageLoad,
                range,
                series
            }
        });
    });
});


// Subscription Simulation
app.post('/api/upgrade', isAuthenticated, (req, res) => {
    const { tier } = req.body;
    if (!['free', 'pro', 'elite'].includes(tier)) {
        return res.status(400).json({ message: 'Invalid tier.' });
    }
    const sql = 'UPDATE users SET subscription_tier = ? WHERE id = ?';
    db.run(sql, [tier, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        req.session.user.subscriptionTier = tier;
        res.status(200).json({ message: `Upgraded to ${tier}`, user: req.session.user });
    });
});

app.put('/api/profile', isAuthenticated, (req, res) => {
    const { firstName, birthDate, heightCm, weightKg, sex } = req.body;

    if (!firstName || !birthDate) {
        return res.status(400).json({ message: 'First name and birth date are required.' });
    }

    const normalizedHeight = normalizeNumberInput(heightCm);
    const normalizedWeight = normalizeNumberInput(weightKg);

    if (Number.isNaN(normalizedHeight) || Number.isNaN(normalizedWeight)) {
        return res.status(400).json({ message: 'Height and weight must be valid numbers.' });
    }

    let normalizedSex = null;
    if (sex) {
        if (!['male', 'female'].includes(String(sex).toLowerCase())) {
            return res.status(400).json({ message: 'Invalid sex value.' });
        }
        normalizedSex = String(sex).toLowerCase();
    }

    const sql = `UPDATE users SET first_name = ?, birth_date = ?, height_cm = ?, weight_kg = ?, sex = COALESCE(?, sex) WHERE id = ?`;
    db.run(sql, [firstName, birthDate, normalizedHeight, normalizedWeight, normalizedSex, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (fetchErr, user) => {
            if (fetchErr || !user) return res.status(500).json({ message: 'Could not refresh user data.' });
            const userPayload = mapUserRow(user);
            req.session.user = userPayload;
            res.status(200).json({ message: 'Profile updated.', user: userPayload });
        });
    });
});

// --- SPA Fallback ---
// This should be the last route. It ensures that any request that doesn't match a static file or an API route gets the main HTML page.
app.get('*', (req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }
    const hasExtension = path.extname(req.path) !== '';
    if (hasExtension) {
        return res.status(404).end();
    }
    res.sendFile(path.join(staticDir, 'index.html'), (err) => {
        if (err) {
            res.status(500).send('Frontend build not found. Please run "npm run build".');
        }
    });
});


// --- Database and Server Initialization ---
const dbPath = path.resolve(__dirname, 'fitness_coach.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Fatal Error: Could not open database', err.message);
        process.exit(1); // Exit if DB connection fails
    } else {
        console.log('Connected to the SQLite database.');
        initializeDb(() => {
            // Start listening for requests only after the DB is ready
            app.listen(PORT, () => {
                console.log(`Server is running on http://localhost:${PORT}`);
            });
        });
    }
});

function initializeDb(callback) {
    const runOrExit = (sql, label) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`Fatal Error: Could not create ${label}`, err.message);
                process.exit(1);
            }
        });
    };

    db.serialize(() => {
        runOrExit(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            subscription_tier TEXT DEFAULT 'free' NOT NULL,
            first_name TEXT,
            birth_date TEXT,
            height_cm REAL,
            weight_kg REAL,
            sex TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`, 'users table');

        runOrExit(`CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            exerciseName TEXT,
            prompt TEXT,
            result TEXT NOT NULL,
            imageBase64 TEXT,
            createdAt TEXT NOT NULL,
            pose_data_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'analyses table');

        runOrExit(`CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0 NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'goals table');

        runOrExit(`CREATE TABLE IF NOT EXISTS workout_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_name TEXT NOT NULL,
            plan_data_json TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'workout_plans table');

        runOrExit(`CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_name TEXT NOT NULL,
            plan_data_json TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'meal_plans table');

        runOrExit(`CREATE TABLE IF NOT EXISTS meal_scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            result_json TEXT NOT NULL,
            image_base64 TEXT,
            notes TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'meal_scans table');

        runOrExit(`CREATE TABLE IF NOT EXISTS performance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            exercise TEXT NOT NULL,
            load REAL NOT NULL,
            reps INTEGER NOT NULL,
            unit TEXT NOT NULL DEFAULT 'kg',
            rpe REAL,
            notes TEXT,
            performedAt TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'performance_logs table');

        runOrExit(`CREATE TABLE IF NOT EXISTS user_tool_states (
            user_id INTEGER PRIMARY KEY,
            data_json TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'user_tool_states table');

        runOrExit(`CREATE TABLE IF NOT EXISTS admin_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_email TEXT NOT NULL,
            action TEXT NOT NULL,
            payload_json TEXT,
            createdAt TEXT NOT NULL
        )`, 'admin_logs table');

        runOrExit(`CREATE TABLE IF NOT EXISTS cms_entries (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updatedBy TEXT,
            updatedAt TEXT NOT NULL
        )`, 'cms_entries table');

        runOrExit(`CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'chat_sessions table');

        runOrExit(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES chat_sessions (id)
        )`, 'chat_messages table');

        runOrExit(`CREATE TABLE IF NOT EXISTS share_links (
            token TEXT PRIMARY KEY,
            plan_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            createdAt TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES workout_plans (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'share_links table');

        runOrExit(`CREATE TABLE IF NOT EXISTS meal_share_links (
            token TEXT PRIMARY KEY,
            plan_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            createdAt TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES meal_plans (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, 'meal_share_links table');

        ensureUserProfileColumns(() => {
            ensureUserCreatedAtColumn(() => {
                console.log('Database schema verified.');
                callback();
            });
        });
    });
}

function ensureUserProfileColumns(done) {
    const requiredColumns = [
        { name: 'first_name', sql: 'ALTER TABLE users ADD COLUMN first_name TEXT' },
        { name: 'birth_date', sql: 'ALTER TABLE users ADD COLUMN birth_date TEXT' },
        { name: 'height_cm', sql: 'ALTER TABLE users ADD COLUMN height_cm REAL' },
        { name: 'weight_kg', sql: 'ALTER TABLE users ADD COLUMN weight_kg REAL' },
        { name: 'sex', sql: 'ALTER TABLE users ADD COLUMN sex TEXT' }
    ];

    db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) {
            console.error('Could not inspect users table', err.message);
            return done();
        }
        const existing = rows.map(row => row.name);
        const statements = requiredColumns
            .filter(col => !existing.includes(col.name))
            .map(col => col.sql);

        const runNext = () => {
            if (!statements.length) return done();
            const sql = statements.shift();
            db.run(sql, (alterErr) => {
                if (alterErr) {
                    console.error(`Failed to run migration "${sql}"`, alterErr.message);
                }
                runNext();
            });
        };

        runNext();
    });
}

function ensureUserCreatedAtColumn(done) {
    db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) {
            console.error('Could not inspect users table for created_at', err.message);
            return done();
        }
        const hasColumn = rows.some(row => row.name === 'created_at');
        if (hasColumn) return done();
        db.run('ALTER TABLE users ADD COLUMN created_at TEXT', (alterErr) => {
            if (alterErr) {
                console.error('Failed to add created_at column', alterErr.message);
                return done();
            }
            db.run(`UPDATE users SET created_at = COALESCE(created_at, datetime('now'))`, () => done());
        });
    });
}
