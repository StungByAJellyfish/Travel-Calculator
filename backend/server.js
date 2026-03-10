import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const WorldBank_url = "https://api.worldbank.org/v2/country/all/indicator/PA.NUS.PPPC.RF?format=json&per_page=20000";
const Advisories_url = "https://cadataapi.state.gov/api/TravelAdvisories";

let isoToWB = {};

async function buildIsoMap() {
    try {
        const response = await fetch(WorldBank_url);
        const json = await response.json();
        const data = json[1];

        isoToWB = {};

        data.forEach(entry => {
            const iso2 = entry.country?.id;
            const name = entry.country?.value;
            if (iso2 && name) {
                isoToWB[iso2] = name;
            }
        });

        console.log("ISO to World Bank mapping built", Object.keys(isoToWB).length, "countries");
    } catch (err) {
        console.error("Failed to build ISO map:", err);
    }
}
buildIsoMap();

app.get("/api/price-level", async (req, res) => {
    try {
        const response = await fetch(WorldBank_url);
        const data = await response.json();
        
        res.json(data);
    } catch (err) {
        console.error("Proxy error:", err);
        res.status(500).json({ error: "Failed to fetch World Bank data" });
    }   
});

app.get("/api/advisories", async (req, res) => {
    try {
        const response = await fetch(Advisories_url);
        const list = await response.json();

        const advisoryMap = {};

        list.forEach(entry => {
            let iso2 = entry.Category?.[0];
            if (!iso2) return;
            if (iso2 === "JA") iso2 = "JP";
            if (iso2 === "GM") iso2 = "DE";
            if (iso2 === "EI") iso2 = "IE";
            const country = isoToWB[iso2];
            if (!country) return;
            const title = entry.Title?.trim();
            if (!title) return;

            const match = title.match(/Level\s+(\d)/);

            if (match) {
                advisoryMap[country] = Number(match[1]);
            }
        });
        
        res.json(advisoryMap);
    } catch (err) {
        console.error("Advisory levels fetch error:", err);
        res.status(500).json({ error: "Failed to fetch travel advisories" });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});