# Deploy a newly trained SAHAYAK sign model

This guide assumes the static or sequence model has already been collected, trained, reviewed, promoted, and tested locally. Do not deploy a candidate model.

## Static sign deployment

1. In the local training project, confirm `model/sahayak_twohand.joblib` is the tested, promoted model and `model/labels_twohand.json` lists old labels plus the new label.
2. Clone/update `https://github.com/Mrjohanjyotikuli/SAHAYAK-ISL` in a separate folder (not over the local training project).
3. Run from the local training project root:

   ```powershell
   .\sync_model_to_github.ps1 -RepoPath "C:\PATH\TO\SAHAYAK-ISL" -ModelType Static
   ```

4. In the cloned GitHub repo, review the diff. Stage only:

   ```powershell
   git add SAHAYAK-Vercel-Deployment/backend/model/sahayak_twohand.joblib SAHAYAK-Vercel-Deployment/backend/labels_twohand.json
   git commit -m "Update static sign recognition model"
   git push origin main
   ```

## Continuous sign deployment

1. Confirm `model/sahayak_sequence.joblib` is the tested, promoted model and the live local status shows old sequence labels plus the new label.
2. Run from the local training project root:

   ```powershell
   .\sync_model_to_github.ps1 -RepoPath "C:\PATH\TO\SAHAYAK-ISL" -ModelType Continuous
   ```

3. In the cloned repo, stage and push only the sequence model:

   ```powershell
   git add SAHAYAK-Vercel-Deployment/backend/model/sahayak_sequence.joblib
   git commit -m "Update continuous sign recognition model"
   git push origin main
   ```

## After the push

- Confirm the Render backend deployment finishes.
- Open `https://sahayak-backend-krh1.onrender.com/api/status` and check `model_ready`, `sequence_model_ready`, `single_sign_labels`, and `sequence_sign_labels` as appropriate.
- Test the new sign and every previously supported sign in `https://sahayak-eight-lac.vercel.app/studio.html`.
- A model-only change does not normally require a Vercel redeploy. If website source files changed, those changes must be committed in the actual frontend path too.

The training CSV, local continuous-sign database, `.venv`, backups and candidate files are not copied by the helper script. Keep them private and backed up locally. Do not replace the whole backend folder with this project's training folder.
