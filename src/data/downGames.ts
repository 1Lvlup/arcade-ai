/**
 * Edit this array to update the dashboard until we hook it to a real database.
 */

export interface DownGame {
    id: string;
    name: string;
    locationZone: string;
    status: "New" | "In Progress" | "Waiting on Parts" | "Testing";
    downSince: string; // ISO date string, e.g. "2025-11-20"
    lastUpdate: string; // ISO date string
    lastUpdateNote: string; // short free text
}

export const downGames: DownGame[] = [
    {
        id: "1",
        name: "Mario Kart DX",
        locationZone: "Zone A - Racing",
        status: "In Progress",
        downSince: "2025-11-18",
        lastUpdate: "2025-11-21",
        lastUpdateNote: "Replaced steering pot, calibrating now.",
    },
    {
        id: "2",
        name: "Halo: Fireteam Raven",
        locationZone: "Zone B - Shooters",
        status: "Waiting on Parts",
        downSince: "2025-11-15",
        lastUpdate: "2025-11-20",
        lastUpdateNote: "Ordered new gun assembly from Betson.",
    },
    {
        id: "3",
        name: "Skee-Ball Glow",
        locationZone: "Zone C - Redemption",
        status: "New",
        downSince: "2025-11-22",
        lastUpdate: "2025-11-22",
        lastUpdateNote: "Ticket dispenser jammed.",
    },
    {
        id: "4",
        name: "Big Bass Wheel",
        locationZone: "Zone C - Redemption",
        status: "Testing",
        downSince: "2025-11-19",
        lastUpdate: "2025-11-22",
        lastUpdateNote: "Spin mechanism fixed, running stress test.",
    },
    {
        id: "5",
        name: "Jurassic Park Arcade",
        locationZone: "Zone B - Shooters",
        status: "Waiting on Parts",
        downSince: "2025-11-10",
        lastUpdate: "2025-11-18",
        lastUpdateNote: "Waiting for monitor replacement.",
    },
];
