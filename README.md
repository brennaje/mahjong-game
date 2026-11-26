# Mahjong Game

A static browser game. No build step or package installation is required.

Your seat and controls stay at the bottom of the table; bot seats stay fixed while East and the other winds rotate between hands.

## Layout and undo

Choose **iPhone** or **PC** in the Layout menu. Drag your tiles with a mouse or finger to rearrange them at any time, in every ruleset, including during the Charleston and other players' turns; a focused tile can also be moved with Alt+Left/Right. A tap or click without dragging still selects or discards as usual. The iPhone view keeps the seats, recent discards, your tiles, turn status, and actions visible. Turn the phone sideways to use the wider landscape layout; tiles and text stay upright. Allow screen rotation in the phone's settings. Tiles shrink to the number in each hand so every hand fits across the screen in either orientation, even with bot tiles shown: the top bot uses one row, side bots use three rows in portrait and two in landscape, and your hand uses two rows in portrait and one in landscape. Expanded panels may require scrolling. Its display buttons reveal the wall, guides, voice control, card, bot tiles, tutor, and settings. Turn narration is spoken aloud; its text is no longer shown on screen but remains available to screen readers. The buttons scroll sideways if they do not all fit. Exposed bot melds remain visible; the bot-hands setting still controls whether their concealed tiles are face up. The layout preference is saved in this browser when storage is available.

Use **Undo** to reverse your most recent supported action before another player acts. After you discard or pass a claim, play pauses: choose **Undo** to change your decision, or **Continue** to let play proceed. Continue makes the move final. Draws, claims, wins, joker exchanges, Riichi, concealed Kongs, and the optional Charleston choice can also be undone until your next action. Charleston tile passes themselves cannot be undone because all four players pass simultaneously.

## Pattern to win and bot play

Every ruleset draws the pattern you need to win in the center of the table, scaled to fit. For card-based American hands this is the chosen card target. For the other rulesets and card-free American practice, it is the closest standard hand to your tiles: your exposed melds, then the planned sets (runs or matching sets, plus jokers in American practice) and the pair. Tiles you still need are dimmed, and the label shows how many are missing. In Riichi, the label reminds you that the hand also needs riichi or a yaku. Special hands such as seven pairs are not planned.

The bots also play toward their own closest pattern. On a card, each bot aims at the card line it is nearest to. In other rulesets, each bot aims at its closest sets-and-pair hand while favoring tiles that are still unseen. Bots use this plan to choose Charleston passes, discards, joker exchanges, and concealed kongs. They claim a discard only when it brings them closer to winning. Riichi bots declare riichi when they can, and once a hand is open they claim only pungs that give it a yaku. The tutor's discard and claim advice uses the same planner.
## American cards and examples

The card controls appear only when the ruleset is **American**, and the selected card pattern is drawn in the center of the American table, scaled to fit both layouts and orientations (on iPhone, choose **Show card**). The ruleset choice is remembered; switching rulesets starts a fresh hand if nothing has been played yet, otherwise it applies to the next hand.

**Card** picks a saved card. The **2026 card (your list)** is built in and selected by default; **Simplified practice (no card)** plays without a card. **Target pattern** chooses what to aim for: **Closest to my hand** follows the pattern your tiles are nearest to, a named pattern shows its closest suit variation and focuses the tutor's pass, discard, and claim advice on it, and **No example** hides the drawing. During play, tiles you still need are dimmed and the label shows how many you need. The target is a guide only: any pattern on the card can win or support exposures. Your card and target choices are saved.

When tutor guidance is on in a card-based American hand, the tutor names your target and the exact tiles missing, lists other close patterns, and suggests the discard or the three Charleston passes (dashed outline) that give up the least. It also advises whether to continue the Charleston, whether a claim brings you closer or exposes too early, and when to exchange a natural tile for an exposed joker. The advice is a learning aid and does not track other players' discards.

Open **Edit, copy, import, or export cards** to change cards. Edit the name or patterns and choose **Save changes**, or **Save as new card** to keep the original. **Restore original 2026 card** resets the built-in card; **Delete card** removes a card you added. **Export** downloads the selected card as a text file and **Import** loads one as a new card, which is useful for backups or moving cards to another device. Each valid pattern is previewed as tiles with its number of variations. Saving checks every line and reports the first problem.

Write one pattern per line as `name | points | X or C | regular or singles | groups | suit rule`; the name and suit rule are optional, and lines starting with `#` are comments. Groups are `tile:count`, totaling 14 tiles. Tiles are `C1`–`C9` (Craks), `D1`–`D9` (Dots), `B1`–`B9` (Bams), winds `E S W N`, dragons `R G 0` (0 is the white dragon/soap), and `F` (flower). Suit letters `x y z v` stand for different suits (`x2:3` is three 2s in one suit), `xn` through `xn+8` make a consecutive run in any starting number, `Dx` is the dragon matching suit `x`, `D*` is any dragon, and `W*` is any wind. A suit rule such as `suits 2` or `suits 1-3` limits how many suits a pattern uses. Each pattern expands into every allowed variation.

The 2026 card is based on the user's supplied list, not an official card. Patterns from that list whose tiles do not total 14, or that use unclear `1D` notation, are kept as `#` comments to fix in the editor. The consecutive pattern labeled as a quint is implemented exactly as written, with four 1s and four 5s. On the built-in card the winner gains the listed points and other players lose none; on your own cards, each other player pays the listed value (a discarder or every player on a self-draw pays double, and jokerless non-singles hands double again). Scores accumulate across hands until reload.

Cards are stored in this browser's local storage, not sent to a server. They are not shared across browsers or devices and may be removed when browser data is cleared, so export cards you want to keep. Saving edits affects the next hand, or the current one if the tiles have not been dealt yet. Storage errors are displayed in the editor.

Private-card wins use the entered value and apply discard, self-draw, jokerless, and Singles and Pairs payout multipliers. Scores are tracked separately from the other modes. Dead-hand declarations, courtesy passes, and special penalty rules are not implemented. Card-based discard review is also not implemented.

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
