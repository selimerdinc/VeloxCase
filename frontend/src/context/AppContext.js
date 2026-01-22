import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import config from '../config';

const AppContext = createContext();

export const AppProvider = ({ children, token }) => {
    const [settings, setSettings] = useState({});
    const [stats, setStats] = useState({ total_cases: 0, total_images: 0, today_syncs: 0 });
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);

    const fetchGlobalData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [settingsRes, statsRes] = await Promise.all([
                axios.get(`${config.API_BASE_URL}/settings`),
                axios.get(`${config.API_BASE_URL}/stats`)
            ]);
            setSettings(settingsRes.data);
            setStats(statsRes.data);
            setInitialized(true);
        } catch (error) {
            console.error("Global data fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const updateSettings = (newData) => {
        setSettings(prev => ({ ...prev, ...newData }));
    };

    const updateStats = (newData) => {
        setStats(prev => ({ ...prev, ...newData }));
    };

    // Auto-fetch on mount if token exists
    useEffect(() => {
        if (token && !initialized) {
            fetchGlobalData();
        }
    }, [token, initialized, fetchGlobalData]);

    return (
        <AppContext.Provider value={{
            settings,
            stats,
            loading,
            initialized,
            fetchGlobalData,
            updateSettings,
            updateStats
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
