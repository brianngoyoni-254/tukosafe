# TukoSafe

TukoSafe is a React prototype exploring how friends could look out for one another during nights out in Nairobi. It demonstrates outing setup, consent controls, check-in states, help prompts, a contact brief, and safety resources.

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Verify production compilation and lint with:

```sh
npm run build
npm run lint
```

## Demo walkthrough

1. Open **Outing** and inspect the sample participants, local consent switches, and expiry timer.
2. Open **Check-in** and advance or reset the missed-check-in states manually.
3. Open **Contact view** to preview a brief built from fixed sample facts; use **Trust Panel** to test the local fact-mismatch fallback.
4. Open **Get help** to try keyword-rule suggestions, review a sample message, and hold the SOS control to preview the state change.
5. Open **Live map** and choose a browser location fix or the Nairobi demo location.

## Prototype limits

- No AI service is connected. Check-in wording and contact briefs are scripted; help suggestions use local keyword rules.
- No SMS, push notification, contact invitation, emergency dispatch, or transport integration is connected. “Send” actions only show local demo feedback.
- Offline queue entries are in-memory demo labels and are not delivered after reconnecting.
- The map is illustrative, friend locations are sample offsets, and location is not broadcast or tracked live.
- Consent switches represent demo state only. The local expiry timer is not a server-enforced privacy control.
- Most app state resets on reload; only the selected visual theme is saved locally.
- This prototype is not an emergency service. Do not rely on it for personal safety or enter real contact details or sensitive location data. Use local emergency services when needed.

## Before submission

Replace the remaining proposal placeholders with the actual team name, member roles, and confirmed challenge category. Add anonymized findings from real, consented user interviews; do not present assumptions as research. Test the complete demo on the intended devices, confirm emergency-resource details against authoritative local sources, and include the repository, demo, and presentation links required by the organizers.