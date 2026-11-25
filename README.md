# Mahjong Game

A static browser game. No build step or package installation is required.

## Publish with GitHub Pages

1. Sign in to GitHub from VS Code using the **Accounts** menu.
2. In **Source Control** (`Ctrl+Shift+G`), commit the staged files. If Git asks for your identity, configure it locally:

   ```powershell
   git config --local user.name "Your Name"
   git config --local user.email "your-github-noreply-address"
   ```

3. Choose **Publish to GitHub** or **Publish Branch**, name the repository `mahjong-game`, and select **Private**.
4. In the new repository, open **Settings → Pages** and set the publishing source to **GitHub Actions**.
5. After the workflow succeeds, get the site URL from the deployment in **Actions** or from **Settings → Pages**. Future pushes to `main` deploy automatically.

The source repository can be private while the published site is public. GitHub requires an Enterprise Cloud organization to publish a private Pages site. Do not put confidential content in the game files.

To try the game locally, serve this folder with a static web server and open `index.html`.
