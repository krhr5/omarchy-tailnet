function filterIPv4(ips) {
  var result = []
  if (!ips || typeof ips.length !== "number") return result
  for (var i = 0; i < ips.length; i++) {
    var ip = String(ips[i] || "")
    if (/^100\./.test(ip)) result.push(ip)
  }
  return result
}

function filterIPv6(ips) {
  var result = []
  if (!ips || typeof ips.length !== "number") return result
  for (var i = 0; i < ips.length; i++) {
    var ip = String(ips[i] || "")
    if (/^fd7a:115c:a1e0:/i.test(ip)) result.push(ip)
  }
  return result
}

function cleanDnsName(name) {
  var value = String(name || "")
  return value.charAt(value.length - 1) === "." ? value.slice(0, -1) : value
}

function shortDnsName(name) {
  var clean = cleanDnsName(name)
  if (clean === "") return ""
  return clean.split(".")[0] || clean
}

function translator(tr) {
  return typeof tr === "function" ? tr : function(key, english) { return english }
}

function displayHostName(hostName, dnsName, tr) {
  var host = String(hostName || "")
  if (host !== "" && host.toLowerCase() !== "localhost") return host
  return shortDnsName(dnsName) || host || translator(tr)("tailscale.unknown", "Unknown")
}

function isMullvadHost(name) {
  var value = String(name || "").toLowerCase()
  var suffix = ".mullvad.ts.net"
  return value.length > suffix.length && value.indexOf(suffix) === value.length - suffix.length
}

function isMullvadPeer(peer) {
  var hostName = String((peer && peer.HostName) || "")
  var dnsName = cleanDnsName((peer && peer.DNSName) || "")
  return isMullvadHost(dnsName) || isMullvadHost(hostName)
}

function osIcon(os) {
  var value = String(os || "").toLowerCase()
  if (value === "linux") return "󰌽"
  if (value === "macos" || value === "ios") return "󰀵"
  if (value === "windows") return "󰍲"
  if (value === "android") return "󰀲"
  if (value === "mullvad") return "󰖂"
  return "󰟀"
}

function accountLabel(account, tr) {
  var t = translator(tr)
  if (!account) return t("tailscale.unknownAccount", "Unknown account")
  if (account.nickname) return String(account.nickname)
  if (account.tailnet) return String(account.tailnet)
  if (account.account) return String(account.account)
  return String(account.id || t("tailscale.unknownAccount", "Unknown account"))
}

function loginPlan(needsLogin, authUrl) {
  var url = String(authUrl || "").trim()
  if (needsLogin === true && /^https?:\/\//.test(url)) {
    return { authUrl: url, command: [] }
  }
  return { authUrl: "", command: ["tailscale", "up"] }
}

// Taildrop is a tailnet feature the admin can turn off, so the button for it
// only makes sense when this profile actually carries the capability.
function hasFileSharing(self) {
  var capability = "https://tailscale.com/cap/file-sharing"
  var capMap = (self && self.CapMap) || null
  if (capMap && capMap[capability] !== undefined) return true
  var capabilities = (self && self.Capabilities) || []
  for (var i = 0; i < capabilities.length; i++) {
    if (String(capabilities[i]) === capability) return true
  }
  return false
}

// Tailscale grades every peer itself — offline, wrong owner, an OS without
// Taildrop, no peer API — so take its word when the status carries one, and
// fall back to same-owner for daemons too old to say.
function isTaildropTarget(peer, selfUserId) {
  var target = peer && peer.TaildropTarget
  if (typeof target === "number" && target !== 0) return target === 1
  var owner = String((peer && peer.UserID) || "")
  return owner !== "" && owner === String(selfUserId || "")
}

function peerFromStatus(id, peer, tr) {
  return {
    id: id,
    HostName: displayHostName(peer.HostName, peer.DNSName, tr),
    UserID: String(peer.UserID || ""),
    TaildropTarget: typeof peer.TaildropTarget === "number" ? peer.TaildropTarget : 0,
    DNSName: cleanDnsName(peer.DNSName),
    DisplayName: displayHostName(peer.HostName, peer.DNSName, tr),
    TailscaleIPs: filterIPv4(peer.TailscaleIPs || []),
    TailscaleIPv6: filterIPv6(peer.TailscaleIPs || []),
    Online: peer.Online === true,
    OS: String(peer.OS || ""),
    Tags: peer.Tags || [],
    ExitNodeOption: peer.ExitNodeOption === true,
    ExitNode: peer.ExitNode === true,
    Mullvad: isMullvadPeer(peer),
    LastSeen: validTime(peer.LastSeen),
    LastHandshake: validTime(peer.LastHandshake),
    Created: validTime(peer.Created),
    KeyExpiry: validTime(peer.KeyExpiry),
    CurAddr: boundedString(peer.CurAddr, 64),
    Relay: boundedString(peer.Relay, 16),
    PeerRelay: boundedString(peer.PeerRelay, 64),
    RxBytes: safeNumber(peer.RxBytes),
    TxBytes: safeNumber(peer.TxBytes),
    Active: peer.Active === true
  }
}

// ---- Omarchy Tailnet additions ----------------------------------------------

function boundedString(value, max) {
  var text = String(value === undefined || value === null ? "" : value)
  return text.length > max ? text.substring(0, max) : text
}

function safeNumber(value) {
  var n = Number(value)
  return isFinite(n) && n >= 0 ? n : 0
}

// Tailscale writes the zero time (0001-01-01) for "never"; treat it as empty.
function validTime(value) {
  var text = boundedString(value, 40)
  if (text === "" || /^0001-/.test(text)) return ""
  var ms = Date.parse(text)
  return isFinite(ms) ? text : ""
}

function formatBytes(bytes) {
  var n = safeNumber(bytes)
  var units = ["B", "KB", "MB", "GB", "TB"]
  var i = 0
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++ }
  return (i === 0 ? String(Math.round(n)) : n.toFixed(n < 10 ? 1 : 0)) + " " + units[i]
}

// Relative time, past or future, with English fallbacks; the panel passes
// translated templates through tr.
function relativeTime(iso, nowMs, tr) {
  var t = translator(tr)
  if (!iso) return ""
  var ms = Date.parse(iso)
  if (!isFinite(ms)) return ""
  var diff = (nowMs === undefined ? Date.now() : nowMs) - ms
  var future = diff < 0
  var s = Math.abs(diff) / 1000
  var value, unit
  if (s < 60) return future ? t("time.soon", "in under a minute") : t("time.now", "just now")
  if (s < 3600) { value = Math.round(s / 60); unit = "m" }
  else if (s < 86400) { value = Math.round(s / 3600); unit = "h" }
  else if (s < 86400 * 60) { value = Math.round(s / 86400); unit = "d" }
  else if (s < 86400 * 730) { value = Math.round(s / (86400 * 30)); unit = "mo" }
  else { value = Math.round(s / (86400 * 365)); unit = "y" }
  var span = value + unit
  return future ? t("time.in", "in %1").replace("%1", span) : t("time.ago", "%1 ago").replace("%1", span)
}

function relayName(code, derpNames) {
  var key = String(code || "")
  if (key === "") return ""
  var names = derpNames || {}
  return names[key] ? String(names[key]) : key
}

// "direct", "relay (Chicago)", or "" when idle/unknown.
function connectionKind(peer) {
  if (!peer || peer.Online !== true) return ""
  if (peer.CurAddr) return "direct"
  if (peer.PeerRelay) return "peer-relay"
  // Relay is the peer's home DERP; traffic only uses it while active.
  if (peer.Active && peer.Relay) return "relay"
  return "idle"
}

function isExitRoute(route) {
  var r = String(route || "")
  return r === "0.0.0.0/0" || r === "::/0"
}

function containsExitRoute(routes) {
  if (!routes || typeof routes.length !== "number") return false
  for (var i = 0; i < routes.length; i++) if (isExitRoute(routes[i])) return true
  return false
}

function parsePrefs(raw) {
  try {
    var d = JSON.parse(String(raw || ""))
    if (!d || typeof d !== "object") return null
    var routes = Array.isArray(d.AdvertiseRoutes) ? d.AdvertiseRoutes : []
    var subnets = []
    for (var i = 0; i < routes.length && subnets.length < 32; i++) {
      if (!isExitRoute(routes[i])) subnets.push(boundedString(routes[i], 64))
    }
    return {
      acceptRoutes: d.RouteAll === true,
      acceptDns: d.CorpDNS === true,
      ssh: d.RunSSH === true,
      advertiseExitNode: containsExitRoute(routes),
      advertisedSubnets: subnets,
      exitNodeAllowLan: d.ExitNodeAllowLANAccess === true,
      shieldsUp: d.ShieldsUp === true,
      operatorUser: boundedString(d.OperatorUser, 64)
    }
  } catch (e) {
    return null
  }
}

function parseDerpNames(raw) {
  var names = {}
  try {
    var d = JSON.parse(String(raw || ""))
    var regions = (d && d.Regions) || {}
    var count = 0
    for (var id in regions) {
      if (++count > 400) break
      var r = regions[id] || {}
      var code = boundedString(r.RegionCode, 16)
      var name = boundedString(r.RegionName, 48)
      if (code !== "") names[code] = name || code
      names["id:" + boundedString(id, 8)] = name || code
    }
  } catch (e) {}
  return names
}

function parseNetcheck(raw, derpNames) {
  try {
    var d = JSON.parse(String(raw || ""))
    if (!d || typeof d !== "object") return null
    var latencies = []
    var rl = d.RegionLatency || {}
    var count = 0
    for (var id in rl) {
      if (++count > 400) break
      var ns = safeNumber(rl[id])
      if (ns > 0) latencies.push({ name: relayName("id:" + id, derpNames) || ("#" + id), ms: ns / 1e6 })
    }
    latencies.sort(function(a, b) { return a.ms - b.ms })
    var preferred = d.PreferredDERP ? relayName("id:" + String(d.PreferredDERP), derpNames) : ""
    var preferredMs = 0
    for (var i = 0; i < latencies.length; i++) if (latencies[i].name === preferred) { preferredMs = latencies[i].ms; break }
    return {
      udp: d.UDP === true,
      ipv4: d.IPv4 === true,
      ipv6: d.IPv6 === true,
      publicV4: boundedString(String(d.GlobalV4 || "").replace(/:\d+$/, ""), 48),
      hardNat: d.MappingVariesByDestIP === true,
      upnp: d.UPnP === true,
      pmp: d.PMP === true,
      pcp: d.PCP === true,
      captivePortal: d.CaptivePortal === true,
      preferredRelay: preferred,
      preferredMs: preferredMs,
      latencies: latencies.slice(0, 4)
    }
  } catch (e) {
    return null
  }
}

function adminMachineUrl(ip) {
  var value = String(ip || "")
  return /^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value) ? "https://login.tailscale.com/admin/machines/" + value : ""
}

function healthMessages(list) {
  var result = []
  if (!list || typeof list.length !== "number") return result
  for (var i = 0; i < list.length && result.length < 3; i++) {
    var text = String(list[i] || "").replace(/\s+/g, " ").trim()
    if (text !== "") result.push(text.length > 160 ? text.substring(0, 157) + "…" : text)
  }
  return result
}

function sliceTableColumn(line, start, end) {
  var text = String(line || "")
  if (start < 0 || start >= text.length) return ""
  if (end < 0) return text.substring(start).trim()
  return text.substring(start, Math.min(end, text.length)).trim()
}

function parseExitNodeList(raw) {
  var lines = String(raw || "").split(/\r?\n/)
  var header = ""
  var headerIndex = -1
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*IP\s+HOSTNAME\s+COUNTRY\s+CITY\s+STATUS\s*$/.test(lines[i])) {
      header = lines[i]
      headerIndex = i
      break
    }
  }
  if (headerIndex === -1) return []

  var ipStart = header.indexOf("IP")
  var hostStart = header.indexOf("HOSTNAME")
  var countryStart = header.indexOf("COUNTRY")
  var cityStart = header.indexOf("CITY")
  var statusStart = header.indexOf("STATUS")
  var byHost = {}

  for (var j = headerIndex + 1; j < lines.length; j++) {
    var line = lines[j]
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue

    var ip = sliceTableColumn(line, ipStart, hostStart)
    var host = sliceTableColumn(line, hostStart, countryStart)
    var country = sliceTableColumn(line, countryStart, cityStart)
    var city = sliceTableColumn(line, cityStart, statusStart)
    var status = sliceTableColumn(line, statusStart, -1)
    if (!isMullvadHost(host)) continue

    byHost[host] = {
      id: "mullvad:" + host,
      HostName: host,
      DNSName: host,
      DisplayName: (city && city !== "Any" ? city + ", " : "") + country,
      TailscaleIPs: ip ? [ip] : [],
      TailscaleIPv6: [],
      Online: true,
      OS: "mullvad",
      Tags: [],
      ExitNodeOption: true,
      ExitNode: status !== "" && status !== "-",
      Mullvad: true,
      Country: country,
      City: city,
      Status: status
    }
  }

  var result = []
  for (var hostName in byHost) result.push(byHost[hostName])
  result.sort(function(a, b) {
    var countryCompare = String(a.Country).localeCompare(String(b.Country))
    if (countryCompare !== 0) return countryCompare
    return String(a.DisplayName).localeCompare(String(b.DisplayName))
  })
  return result
}

function mullvadRegionOptions(nodes) {
  var byRegion = {}
  var values = Array.isArray(nodes) ? nodes : []
  for (var i = 0; i < values.length; i++) {
    var node = values[i] || {}
    if (node.Mullvad !== true) continue
    var country = String(node.Country || "").trim()
    var city = String(node.City || "").trim()
    if (country === "") continue
    if (city === "" || city === "Any") continue

    var key = country + "\n" + city
    if (byRegion[key]) continue

    var option = {}
    for (var propertyName in node) option[propertyName] = node[propertyName]
    option.id = "mullvad-region:" + key
    option.DisplayName = city + ", " + country
    option.Country = country
    option.City = city
    option.MullvadRegion = true
    byRegion[key] = option
  }

  var result = []
  for (var name in byRegion) result.push(byRegion[name])
  result.sort(function(a, b) {
    var countryCompare = String(a.Country).localeCompare(String(b.Country))
    if (countryCompare !== 0) return countryCompare
    return String(a.City).localeCompare(String(b.City))
  })
  return result
}

function mullvadCountryOptions(nodes) {
  return mullvadRegionOptions(nodes)
}

// message is the IPC status() text, so it stays English.
function parseStatus(raw, tr) {
  var text = String(raw || "").trim()
  if (text === "") return { ok: true, unavailable: true, message: "Disconnected" }

  try {
    var data = JSON.parse(text)
    var backendState = String(data.BackendState || "Unknown")
    var self = data.Self || {}
    var selfIps = filterIPv4(self.TailscaleIPs || data.TailscaleIPs || [])
    var peers = []
    var exitNodes = []
    var rawPeers = data.Peer || {}

    for (var id in rawPeers) {
      var peer = rawPeers[id] || {}
      var normalized = peerFromStatus(id, peer, tr)
      if (normalized.Mullvad) continue
      peers.push(normalized)
      if (normalized.Online && normalized.ExitNodeOption) exitNodes.push(normalized)
    }

    peers.sort(function(a, b) {
      if (a.Online !== b.Online) return a.Online ? -1 : 1
      return String(a.HostName).localeCompare(String(b.HostName))
    })
    exitNodes.sort(function(a, b) {
      return String(a.HostName).localeCompare(String(b.HostName))
    })

    return {
      ok: true,
      unavailable: false,
      backendState: backendState,
      running: backendState === "Running",
      needsLogin: backendState === "NeedsLogin",
      authUrl: String(data.AuthURL || ""),
      selfName: displayHostName(self.HostName, self.DNSName, tr),
      selfDnsName: cleanDnsName(self.DNSName),
      selfIp: selfIps.length > 0 ? selfIps[0] : "",
      selfUserId: String(self.UserID || ""),
      fileSharing: hasFileSharing(self),
      selfIpv6: filterIPv6(self.TailscaleIPs || []).length > 0 ? filterIPv6(self.TailscaleIPs || [])[0] : "",
      selfOs: boundedString(self.OS, 24),
      selfRelay: boundedString(self.Relay, 16),
      selfKeyExpiry: validTime(self.KeyExpiry),
      selfExitNodeApproved: containsExitRoute(self.AllowedIPs || []),
      version: boundedString(String(data.Version || "").split("-")[0], 32),
      magicDnsSuffix: boundedString(data.MagicDNSSuffix, 128),
      health: healthMessages(data.Health),
      peers: peers,
      exitNodes: exitNodes
    }
  } catch (e) {
    return { ok: false, unavailable: true, message: "Status error", error: "Failed to parse tailscale status" }
  }
}

function parseAccounts(raw, tr) {
  var text = String(raw || "").trim()
  if (text === "") return { accounts: [], selectedAccountId: "", selectedAccountLabel: "" }

  try {
    var parsed = JSON.parse(text)
    var next = []
    var selected = null
    if (parsed && typeof parsed.length === "number") {
      for (var i = 0; i < parsed.length; i++) {
        var rawAccount = parsed[i] || {}
        var account = {
          id: String(rawAccount.id || rawAccount.ID || ""),
          nickname: String(rawAccount.nickname || rawAccount.Nickname || rawAccount.name || rawAccount.Name || ""),
          tailnet: String(rawAccount.tailnet || rawAccount.Tailnet || ""),
          account: String(rawAccount.account || rawAccount.Account || rawAccount.loginName || rawAccount.LoginName || rawAccount.user || rawAccount.User || ""),
          selected: rawAccount.selected === true || rawAccount.Selected === true
        }
        next.push(account)
        if (account.selected === true) selected = account
      }
    }
    return {
      accounts: next,
      selectedAccountId: selected ? String(selected.id || "") : "",
      selectedAccountLabel: selected ? accountLabel(selected, tr) : ""
    }
  } catch (e) {
    return { accounts: [], selectedAccountId: "", selectedAccountLabel: "" }
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    filterIPv4: filterIPv4,
    filterIPv6: filterIPv6,
    cleanDnsName: cleanDnsName,
    shortDnsName: shortDnsName,
    displayHostName: displayHostName,
    osIcon: osIcon,
    accountLabel: accountLabel,
    loginPlan: loginPlan,
    hasFileSharing: hasFileSharing,
    isTaildropTarget: isTaildropTarget,
    isMullvadPeer: isMullvadPeer,
    peerFromStatus: peerFromStatus,
    parseExitNodeList: parseExitNodeList,
    mullvadRegionOptions: mullvadRegionOptions,
    mullvadCountryOptions: mullvadCountryOptions,
    parseStatus: parseStatus,
    parseAccounts: parseAccounts,
    formatBytes: formatBytes,
    relativeTime: relativeTime,
    relayName: relayName,
    connectionKind: connectionKind,
    parsePrefs: parsePrefs,
    parseDerpNames: parseDerpNames,
    parseNetcheck: parseNetcheck,
    adminMachineUrl: adminMachineUrl,
    healthMessages: healthMessages
  }
}
