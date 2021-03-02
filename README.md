# CNAME-cloaked trackers

A CNAME (Canonical Name) is a type of DNS record that defines an alias from one domain name to another. It’s a basic function used by millions of websites to create unique subdomains for different services, such as mail, search, etc. To allow for seamless interaction, the subdomains are trusted just like the primary domain. CNAME-cloaked tracking abuses this fundamental mechanic and creates many more problems than unwelcome data collection.

![image](https://user-images.githubusercontent.com/5947035/109689530-6ed9a400-7b96-11eb-85a8-abb0b5a54749.png)

There are numerous issues with this approach and the most severe one is that third-parties (disguised as first-parties) can potentially receive all kinds of data that's stored in the first-party cookies.

![image](https://user-images.githubusercontent.com/5947035/109689550-74cf8500-7b96-11eb-873d-44d0ce8772c0.png)

## The Problem

Browsers themselves can’t protect users from CNAME-cloaked tracking. But content blockers can: AdGuard and AdGuard DNS, as well as uBO on Mozilla Firefox can already block such “hidden trackers”. Still, due to limitations in Chrome, Chromium and Safari, regular extensions can’t dynamically resolve hostnames and remove trackers. They’re limited to filter lists, and it’s hard to imagine someone would check the whole web in search for CNAME-cloaked trackers. 

The problem is that **over 90% of all users are still vulnerable** to CNAME-cloaked trackers.

## The Solution

Thanks to [AdGuard DNS](https://adguard.com/adguard-dns/overview.html) that does block CNAME-cloaked trackers, we actually know what domain names they are hidden behind.

This is the most complete auto-updating repository of actively used hidden trackers. The list is to be updated on a regular basis to add new hidden trackers as they’re detected.

We're going to block those trackers in [AdGuard Tracking Protection list](https://github.com/AdguardTeam/AdGuardFilters) so now even the users of Chrome and Safari extensions will be protected from CNAME abuse.

We hope that other filter lists makers (EasyPrivacy in particular) will also use this repository. This way we'll cover most of the content blockers and finally get rid of CNAME abuse.