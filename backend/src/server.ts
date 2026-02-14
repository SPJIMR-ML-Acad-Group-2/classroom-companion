import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Supabase Client (Service Role for Backend)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Role Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Basic Route
app.get('/', (req: Request, res: Response) => {
    res.send('Classroom Companion Backend is running');
});

// API Routes
// 1. Get User Profile
app.get('/api/auth/profile', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string; // Expecting User ID from frontend for now (simple)

    if (!userId) {
        return res.status(400).json({ error: 'Missing x-user-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('t106_user_profile')
            .select('primary_role, access_status')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get Tiles for Role
app.get('/api/dashboard/tiles', async (req: Request, res: Response) => {
    const roleCode = req.query.role as string;

    if (!roleCode) {
        return res.status(400).json({ error: 'Missing role query parameter' });
    }

    try {
        const { data, error } = await supabase
            .from('t104_role_tile_access')
            .select('tile_key, tile_label, can_view')
            .eq('role_code', roleCode)
            .eq('can_view', true)
            .order('id'); // Should order by tile sort_order if joined, but t104 doesn't have it natively denormalized yet. 
        // Ideally join with t102. For now, simple select.

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
