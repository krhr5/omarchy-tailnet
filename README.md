# Omarchy Tailnet

A Tailscale bar widget for [Omarchy](https://omarchy.org/). It builds on Omarchy's built-in Tailscale widget and adds the things you would otherwise open the admin console or a terminal for.

## Features

- **On/off switch** in the panel. Right-click the bar icon to toggle, middle-click to refresh.
- **Exit nodes:** pick a tailnet exit node or a Mullvad region (searchable, with your recent regions kept at the top). There's also an **Allow LAN access** switch, so printers and other local devices keep working while you're on an exit node. When the tailnet has no exit nodes, the panel explains how to add one.
- **Machines:** every device on the tailnet, offline ones included and dimmed with "last seen". Each machine shows whether its connection is direct, relayed (and through which relay), or idle. Click a machine to expand its details: OS, IPv4 and IPv6 addresses, DNS name, connection, last handshake, traffic, when it was added, key expiry, and tags. There's also a button to its page in the admin console. Copy and Taildrop send buttons work as in the built-in widget.
- **This device:**
  - its IP and DNS name, with copy buttons, plus Tailscale version, home relay and key expiry
  - switches for **Run as exit node** (shows when it's waiting for approval), **Tailscale SSH**, **Use tailnet DNS** and **Use subnet routes**
  - **Machine page** and **Admin console** buttons
- **Network check:** run on demand. It shows whether direct connections are possible (UDP), NAT type, IPv4/IPv6, port mapping (UPnP / NAT-PMP / PCP), captive portal detection, the nearest relay and other relay latencies.
- **Connections:** switch between Tailscale accounts when you have more than one.
- **Translations:** all 50 Omarchy languages for the built-in widget's strings. The new strings are English only so far, and translations are welcome.

## Requirements

- Omarchy Quattro (the Quickshell-based Omarchy shell)
- [Tailscale](https://tailscale.com/) with the `tailscale` CLI on `PATH`
- Your user set as Tailscale operator, so the panel can change settings without `sudo`:

  ```bash
  sudo tailscale set --operator=$USER
  ```

  If it isn't set, the panel offers to authorize it through a polkit prompt.
- `wl-copy` (from `wl-clipboard`) for the copy buttons
- Omarchy's `omarchy-tailscale-send` (Taildrop send) and `omarchy-launch-browser` (login and admin-console links), which ship with Omarchy
- Mullvad regions appear only when the Tailscale [Mullvad add-on](https://tailscale.com/kb/1258/mullvad-exit-nodes) is enabled **for this device** in the admin console

There are no other dependencies, and the plugin installs nothing system-wide.

## Install

```bash
omarchy plugin add https://github.com/krhr5/omarchy-tailnet --enable
```

To run it in place of Omarchy's built-in Tailscale widget, disable that one:

```bash
omarchy plugin disable omarchy.tailscale
```

Move the widget around the bar with `omarchy bar move io.github.krhr5.omarchy-tailnet --section right`.

## Remove

```bash
omarchy plugin remove io.github.krhr5.omarchy-tailnet
```

To return to the built-in widget, run `omarchy plugin enable omarchy.tailscale`.

## Keyboard shortcuts

Inside the panel:

- `j` / `k` or arrows: move the cursor
- `enter` / `space`: activate the current row
- `c` / `n` / `d`: copy the selected machine's IP / name / DNS name
- `s`: send files to the selected machine (Taildrop)
- `t`: toggle Tailscale
- `/`: search machines (large tailnets)
- `esc`: close

## What it runs

Everything goes through the local `tailscale` CLI. The plugin makes no network requests of its own.

| When | Command |
|---|---|
| Every refresh (30 s by default; set it in the widget settings) | `tailscale status --json` (without peers while the panel is closed), `tailscale exit-node list`, `tailscale switch --list --json` |
| While the panel is open | `tailscale debug prefs`; also `tailscale debug derp-map`, once, for relay names |
| A switch is flipped | `tailscale set --advertise-exit-node`, `--ssh`, `--accept-dns`, `--accept-routes`, `--exit-node-allow-lan-access` or `--exit-node` (only the flag you changed) |
| **Run check** is clicked | `tailscale netcheck --format=json`. It sends STUN probes to Tailscale's relay servers. |

Shell IPC (`omarchy-shell io.github.krhr5.omarchy-tailnet <fn>`): `open`, `close`, `toggle`, `refresh`, `up`, `down`, `toggleTailscale`, `status`, `netcheck`.

## Credits

This plugin is based on Omarchy's first-party Tailscale widget (`omarchy.tailscale`, MIT, © David Heinemeier Hansson), including its translations. The added features were inspired by [Trayscale](https://github.com/DeedleFake/trayscale), but no Trayscale code is used.

## License

[MIT](LICENSE)
