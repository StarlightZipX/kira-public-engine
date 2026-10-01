# 🚀 CRITICAL RULE: Always Commit & Push to Render (GitHub) After Completing Work

## Context & Purpose
The live production website for Kira AI System is hosted on **Render**, which is configured with continuous deployment watching the GitHub repository:
- **Repository:** `https://github.com/StarlightZipX/kira-public-engine.git`
- **Branch:** `main`

## Mandatory Protocol
Whenever you complete any feature, bug fix, UI enhancement, or configuration update:
1. **Never stop at just local testing:** Local tests and screenshots are essential, but the task is NOT complete until the changes are deployed to Render.
2. **Stage and Commit:**
   - Review `git status` to ensure all necessary code, assets, and templates are staged.
   - Write a clear, professional conventional commit message describing the exact changes.
3. **Push to Origin Main:**
   - Run `git push origin main`.
   - Verify that the push succeeds.
4. **Notify Boss:**
   - Confirm in your final response to Boss that the latest updates have been pushed to GitHub / Render for live deployment.
