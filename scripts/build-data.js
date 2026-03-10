import tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'data');

const FETCH_HEADERS = {
    'Host': 'stats.nba.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
    'Connection': 'keep-alive',
    'Referer': 'https://stats.nba.com/',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
};

async function fetchNbaData(url) {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`NBA API Error: ${res.status}`);
    return await res.json();
}

// Normalize value between min and max
function minMaxScale(val, min, max) {
    if (val < min) return 0;
    if (val > max) return 1;
    return (val - min) / (max - min);
}

// Convert stats to features: [PTS_N, AST_N, REB_N, TS_N, PER_mock_N]
// Because true PER/TS% aren't in the basic dash API, we calculate pseudo-efficiency
// True Shooting = PTS / (2 * (FGA + 0.44 * FTA))
function calcFeatures(stats) {
    const pts = stats.PTS || 0;
    const ast = stats.AST || 0;
    const reb = stats.REB || 0;
    const fga = stats.FGA || 0;
    const fta = stats.FTA || 0;
    const fg_pct = stats.FG_PCT || 0; // Backup
    
    let ts_pct = fg_pct;
    const denominator = 2 * (fga + 0.44 * fta);
    if (denominator > 0) {
        ts_pct = pts / denominator;
    }

    // Mock PER: roughly PTS + REB + AST + STL + BLK - TOV - MissedFG - MissedFT
    const stl = stats.STL || 0;
    const blk = stats.BLK || 0;
    const tov = stats.TOV || 0;
    const fgm = stats.FGM || 0;
    const ftm = stats.FTM || 0;
    const missedFG = fga - fgm;
    const missedFT = fta - ftm;
    const mockPer = pts + reb + ast + stl + blk - tov - missedFG - missedFT;

    return [
        minMaxScale(pts, 0, 30),
        minMaxScale(ast, 0, 10),
        minMaxScale(reb, 0, 15),
        minMaxScale(ts_pct, 0.3, 0.7),
        minMaxScale(mockPer, -5, 25)
    ];
}

async function fetchSophomores() {
    console.log("1. Fetching 2024-25 Rookie Stats (Year 1) & 2025-26 Sophomore Stats (Year 2)...");
    
    // Year 1 (Rookie class of 2024-25)
    const urlY1 = 'https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=Rookie&PlayerPosition=&PlusMinus=N&Rank=N&Season=2024-25&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=';
    
    // Year 2 (Sophomore class of 2025-26)
    const urlY2 = 'https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=Sophomore&PlayerPosition=&PlusMinus=N&Rank=N&Season=2025-26&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=';

    const [dataY1, dataY2] = await Promise.all([
        fetchNbaData(urlY1),
        fetchNbaData(urlY2)
    ]);

    const headersY1 = dataY1.resultSets[0].headers;
    const rowsY1 = dataY1.resultSets[0].rowSet;
    const playersY1 = rowsY1.map(r => { let obj = {}; headersY1.forEach((h, i) => obj[h] = r[i]); return obj; });

    const headersY2 = dataY2.resultSets[0].headers;
    const rowsY2 = dataY2.resultSets[0].rowSet;
    const playersY2 = rowsY2.map(r => { let obj = {}; headersY2.forEach((h, i) => obj[h] = r[i]); return obj; });

    console.log(`Found ${playersY1.length} rookies from 24-25, and ${playersY2.length} sophomores from 25-26.`);

    // Map Y2 by ID for easy lookup
    const y2Map = {};
    playersY2.forEach(p => y2Map[p.PLAYER_ID] = p);

    // Merge logic
    return playersY1.map(p1 => {
        const p2 = y2Map[p1.PLAYER_ID]; // Might be undefined if they didn't play in Y2
        
        // Helper to format stats
        const formatStats = (p) => {
            if (!p) return null;
            const ts_pct = (p.FGA + 0.44 * p.FTA) > 0 ? (p.PTS / (2 * (p.FGA + 0.44 * p.FTA))) : p.FG_PCT;
            return {
                stats_raw: {
                    PTS: p.PTS,
                    TRB: p.REB,
                    AST: p.AST,
                    TS_PERC: parseFloat(ts_pct.toFixed(3)),
                    PER: (p.PTS + p.REB + p.AST + p.STL + p.BLK - p.TOV - (p.FGA - p.FGM) - (p.FTA - p.FTM)).toFixed(1)
                },
                features: calcFeatures(p)
            };
        };

        const y1Data = formatStats(p1);
        const y2Data = formatStats(p2);

        return {
            id: p1.PLAYER_ID.toString(),
            name: p1.PLAYER_NAME,
            teamId: p1.TEAM_ID.toString(),
            y1: y1Data,
            y2: y2Data // Could be null
        };
    }).sort((a, b) => b.y1.stats_raw.PTS - a.y1.stats_raw.PTS);
}

// Generate training data internally to avoid 50 API calls to NBA stats (Rate Limiting issues during CI)
function generateTrainingData() {
    console.log("2. Preparing Historical NBA Legends Training Data...");
    // Classes: 0 (S), 1 (A), 2 (B), 3 (C), 4 (Bust)
    const trainingSamples = [
        // S-Tier (Generational Rookies: Jordan, LeBron, Wilt, Kareem, Magic, Wemby context)
        { stats: {PTS: 28.2, AST: 5.9, REB: 6.5, FGA: 19.8, FGM: 10.2, FTA: 9.1, FTM: 7.7, STL: 2.4, BLK: 0.8, TOV: 3.5}, class: 0 },
        { stats: {PTS: 20.9, AST: 5.9, REB: 5.5, FGA: 18.9, FGM: 7.9, FTA: 5.8, FTM: 4.4, STL: 1.6, BLK: 0.7, TOV: 3.5}, class: 0 },
        { stats: {PTS: 37.6, AST: 2.3, REB: 27.0, FGA: 32.1, FGM: 14.8, FTA: 13.8, FTM: 8.0, STL: 0, BLK: 0, TOV: 0}, class: 0 },
        { stats: {PTS: 21.4, AST: 3.9, REB: 10.6, FGA: 16.7, FGM: 7.8, FTA: 5.1, FTM: 4.1, STL: 1.2, BLK: 3.6, TOV: 3.7}, class: 0 }, // Wemby approx
        
        // A-Tier (All-Star Rookies: Carmelo, Lillard, Blake Griffin)
        { stats: {PTS: 21.0, AST: 2.8, REB: 6.1, FGA: 17.9, FGM: 7.6, FTA: 7.7, FTM: 5.9, STL: 1.2, BLK: 0.5, TOV: 3.0}, class: 1 },
        { stats: {PTS: 19.0, AST: 6.5, REB: 3.1, FGA: 15.7, FGM: 6.7, FTA: 4.4, FTM: 3.7, STL: 0.9, BLK: 0.2, TOV: 3.0}, class: 1 },
        { stats: {PTS: 22.5, AST: 3.8, REB: 12.1, FGA: 16.2, FGM: 8.2, FTA: 8.5, FTM: 5.4, STL: 0.8, BLK: 0.5, TOV: 2.7}, class: 1 },
        
        // B-Tier (Solid Starters)
        { stats: {PTS: 14.5, AST: 4.2, REB: 4.0, FGA: 12.0, FGM: 5.5, FTA: 3.5, FTM: 2.8, STL: 1.0, BLK: 0.3, TOV: 2.5}, class: 2 },
        { stats: {PTS: 12.0, AST: 2.1, REB: 7.5, FGA: 9.5, FGM: 4.5, FTA: 4.0, FTM: 2.6, STL: 0.6, BLK: 1.1, TOV: 1.8}, class: 2 },

        // C-Tier (Role Players / Rotation)
        { stats: {PTS: 7.5, AST: 1.5, REB: 3.2, FGA: 6.0, FGM: 2.5, FTA: 2.0, FTM: 1.4, STL: 0.5, BLK: 0.2, TOV: 1.0}, class: 3 },
        { stats: {PTS: 5.0, AST: 3.5, REB: 1.5, FGA: 4.5, FGM: 1.8, FTA: 1.0, FTM: 0.8, STL: 0.8, BLK: 0.1, TOV: 1.5}, class: 3 },

        // Bust-Tier (Out of rotation early)
        { stats: {PTS: 3.5, AST: 0.5, REB: 1.2, FGA: 3.5, FGM: 1.2, FTA: 1.0, FTM: 0.6, STL: 0.2, BLK: 0.1, TOV: 0.8}, class: 4 },
        { stats: {PTS: 2.0, AST: 1.1, REB: 0.8, FGA: 2.5, FGM: 0.7, FTA: 0.5, FTM: 0.3, STL: 0.1, BLK: 0.0, TOV: 0.6}, class: 4 },
    ];

    // To prevent overfitting and make it robust, we'll generate variations summing to ~200 samples
    const generatedX = [];
    const generatedY = [];

    for (let i = 0; i < 200; i++) {
        const base = trainingSamples[Math.floor(Math.random() * trainingSamples.length)];
        
        // Add ±15% noise to stats
        const noise = () => 1 + (Math.random() * 0.3 - 0.15);
        
        const syntheticStats = {
            PTS: base.stats.PTS * noise(),
            AST: base.stats.AST * noise(),
            REB: base.stats.REB * noise(),
            FGA: base.stats.FGA * noise(),
            FGM: base.stats.FGM * noise(),
            FTA: base.stats.FTA * noise(),
            FTM: base.stats.FTM * noise(),
            STL: base.stats.STL * noise(),
            BLK: base.stats.BLK * noise(),
            TOV: base.stats.TOV * noise(),
            FG_PCT: base.stats.FGM / base.stats.FGA
        };

        generatedX.push(calcFeatures(syntheticStats));
        generatedY.push(base.class);
    }

    return { x: generatedX, y: generatedY };
}

async function buildData() {
    console.log("🏀 NBA Legend-O-Meter Data Builder");
    console.log("-----------------------------------");
    
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const sophomores = await fetchSophomores();
    // Keep top 50 strictly by Y1 points
    const validSophomores = sophomores.filter(p => p.y1 && p.y1.stats_raw.PTS > 2 && p.y1.stats_raw.TS_PERC > 0).slice(0, 100);
    
    fs.writeFileSync(path.join(OUT_DIR, 'players.json'), JSON.stringify(validSophomores, null, 2));
    console.log(`Saved ${validSophomores.length} players to players.json!`);

    const { x, y } = generateTrainingData();

    console.log("3. Building and compiling TF Neural Network...");
    const model = tf.sequential();
    
    model.add(tf.layers.dense({ inputShape: [5], units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 5, activation: 'softmax' }));

    model.compile({
        optimizer: tf.train.adam(0.005),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    console.log("4. Training model with historical NBA Rookie data...");
    
    const xTrain = tf.tensor2d(x);
    const yTrain = tf.oneHot(tf.tensor1d(y, 'int32'), 5);

    await model.fit(xTrain, yTrain, {
        epochs: 50,
        batchSize: 16,
        validationSplit: 0.2,
        verbose: 0 
    });
    
    xTrain.dispose();
    yTrain.dispose();

    console.log("5. Exporting model weights and topology to /data...");
    await model.save(`file://${OUT_DIR}`);
    
    console.log("✅ Pipeline completed successfully!");
}

buildData().catch(err => {
    console.error("Pipeline failed:", err);
    process.exit(1);
});
