# SAHAYAK — Install and Use FAQ
**LEGANG AI help content | Updated 23 October 2026**

This page contains the installation and first-use instructions that should accompany SAHAYAK's user guides, presentation, and master guide.

## How do I install SAHAYAK on an Android phone?
1. Open the deployed SAHAYAK website in **Google Chrome**. Avoid opening it inside another app's in-app browser.
2. Wait for the page to finish loading and ensure the website is served over HTTPS.
3. Open Chrome's three-dot menu (⋮).
4. Choose **Install app** or **Add to Home screen**. The wording depends on Chrome and the phone.
5. Confirm the installation, then open SAHAYAK from the new app icon.

If the install option is not shown, refresh the website, confirm that the latest deployment is live, and try again in Chrome. Installability can vary by browser and device.

### What if the old SAHAYAK icon is still showing?
Android may keep an icon from an existing installation. Wait for the latest website deployment, remove the old SAHAYAK home-screen shortcut/app, reopen the site in Chrome, and install it again. The manifest's icon URLs must point to the current logo, and the logo asset must be available at those URLs. A browser refresh alone may not replace an already-installed app's icon immediately.

### How do I install it on an iPhone or iPad?
Open the website in Safari, tap **Share**, then choose **Add to Home Screen**. Available options can vary by iOS version.

## How do I use SAHAYAK?
1. Open SAHAYAK and select **Live Studio**.
2. Choose the recognition mode available for the sign you want to test.
3. Allow camera access when the browser asks. LEGANG AI's FAQ does not turn on the camera.
4. Keep your hand or hands clearly visible, with suitable lighting and a stable camera view.
5. For a **static sign**, hold the pose steadily. For a **continuous sign**, perform the complete movement.
6. Read the prediction and confidence/result information. Repeat if the result is uncertain.
7. Use the phrasebook or text-to-speech features when available.

## Does installing SAHAYAK mean recognition works offline?
No. The installable PWA can cache parts of the website interface for later viewing, but live recognition and backend-powered predictions still require a connection to the deployed SAHAYAK backend. Do not promise fully offline recognition unless that capability has been implemented and tested.

## What is LEGANG AI?
LEGANG AI is the on-page SAHAYAK companion. Its predefined FAQ answers explain installation, basic use, supported-sign information, and common troubleshooting. It is not a certified sign-language interpreter and does not independently guarantee the correctness of a prediction.

## The camera does not work. What should I check?
- Use a browser that supports camera access and grant permission to the website.
- Confirm the page uses HTTPS (or localhost during local development).
- Close other apps that may be using the camera, then reload the page.
- Check lighting and position both hands inside the camera view when required.
- If the interface opens but predictions fail, check the live backend connection; a cached interface does not cache live predictions.

## Important limitations
SAHAYAK is a development prototype. Recognition depends on the labels and examples in the installed models, camera conditions, framing, and lighting. It should not be presented as a complete ISL sentence translator or a substitute for a qualified interpreter.
