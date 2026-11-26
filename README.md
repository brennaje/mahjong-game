# Mahjong Game

A static browser game. No build step or package installation is required.

Your seat and controls stay at the bottom of the table; bot seats stay fixed while East and the other winds rotate between hands.

## Layout and undo

Choose **iPhone** or **PC** in the Layout menu. The iPhone view keeps the seats, recent discards, your tiles, turn status, and actions visible. Turn the phone sideways to use the wider landscape layout; tiles and text stay upright. Allow screen rotation in the phone's settings. Some expanded information or longer hands may require scrolling. Its display buttons reveal the wall, guides, narration and voice control, card, bot tiles, tutor, and settings. The buttons scroll sideways if they do not all fit. Exposed bot melds remain visible; the bot-hands setting still controls whether their concealed tiles are face up. The layout preference is saved in this browser when storage is available.

Use **Undo** to reverse your most recent supported action before another player acts. After you discard or pass a claim, play pauses: choose **Undo** to change your decision, or **Continue** to let play proceed. Continue makes the move final. Draws, claims, wins, joker exchanges, Riichi, concealed Kongs, and the optional Charleston choice can also be undone until your next action. Charleston tile passes themselves cannot be undone because all four players pass simultaneously.

## American cards and examples

At the top, choose simplified practice, the provided patterns, or a saved private card for the next American hand. Choose a combination to see one graphical example. The example is a target only; all available combinations and their allowed variations on the chosen card can win or support exposures. Changing the card does not change a hand already in progress.

The provided patterns are based on the user's supplied list, not an official card. Patterns with too few or too many tiles, or unclear `1D` notation, are listed but unavailable. The 14-tile consecutive pattern labeled as a quint is implemented exactly as written, with four 1s and four 5s. Suit groups vary independently within the stated suit counts; `2026` uses one suit for its number tiles, matching dragons follow the associated suit, and the unspecified dragon in the 369 pattern can be any dragon. The odd pattern's dragon matches its 555 group. The consecutive run uses one suit and can start at 1 through 5. All available provided patterns are treated as exposable. With a one-point base, the winner gains the listed points and other players lose none; these scores accumulate across hands until reload.

For private entries, open **Private American card** and enter one concrete 14-tile combination per line, including each suit or number variation you want to use. The form explains the tile codes and group sizes and previews each valid line as tiles, including unsaved edits. Required jokers appear in the example; additional jokers can substitute in groups of three or more. Save it on the device, choose **Saved private card** at the top, select American, and start a new hand. Only entered combinations are recognized; an incomplete entry is not a complete card.

The card is stored in this browser's local storage, not sent to a server. It is not shared across browsers or devices and may be removed when browser data is cleared. Saving edits affects the next hand, not one already in progress. Delete the saved card using the form. Browser storage errors are displayed there.

Private-card wins use the entered value and apply discard, self-draw, jokerless, and Singles and Pairs payout multipliers. Scores are tracked separately from the other modes. Dead-hand declarations, courtesy passes, and special penalty rules are not implemented. Card-based discard review and card-aware bot strategy are also not implemented.

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
