# CNAME-cloaked trackers

A CNAME (Canonical Name) is a type of DNS record that defines an alias from one domain name to another.
It is a basic function used by millions of websites to create unique subdomains for different services,
such as mail, search, etc. To allow for seamless interaction, the subdomains are trusted just like the primary domain.
CNAME-cloaked tracking abuses this fundamental mechanic and creates many more problems than unwelcome data collection.

![Frame 1](https://user-images.githubusercontent.com/5947035/109944388-3bf2f580-7ce7-11eb-92b0-44b6ab2b4d9c.jpg)

There are numerous issues with this approach and the most severe one is that third-parties (disguised as first-parties)
can potentially receive all kinds of data that is stored in the first-party cookies.

![Frame 2](https://user-images.githubusercontent.com/5947035/109944398-3eede600-7ce7-11eb-9895-382a360e153b.jpg)

## The Problem

Browsers themselves cannot protect users from CNAME-cloaked tracking. But content blockers can:
AdGuard and AdGuard DNS, as well as uBO on Mozilla Firefox can already block such “hidden trackers”.
Still, due to limitations in Chrome, Chromium and Safari, regular extensions cannot dynamically resolve hostnames
and remove trackers. They are limited to filter lists,
and it is hard to imagine someone would check the whole web in search for CNAME-cloaked trackers.

The problem is that **over 90% of all users are still vulnerable** to CNAME-cloaked trackers.

## The Solution

Thanks to [AdGuard DNS](https://adguard.com/adguard-dns/overview.html) that does block CNAME-cloaked trackers,
we actually know what domain names they are hidden behind.

This is the most complete auto-updating repository of actively used hidden trackers.
The list is to be updated on a regular basis to add new hidden trackers as they are detected.

We are going to block those trackers in [AdGuard Tracking Protection list](https://github.com/AdguardTeam/AdGuardFilters)
so now even the users of Chrome and Safari extensions will be protected from CNAME abuse.

We hope that other filter lists makers (EasyPrivacy in particular) will also use this repository.
This way we will cover most of the content blockers and finally get rid of CNAME abuse.

## The Lists
​
It is important to note that not all CNAME-cloaked trackers can be completely blocked.
If it is an advertisement or a tracker, blocking it is not difficult because the user does not notice it. But if CNAME-cloaked trackers point to microsites or landing pages, blocking the entire domain will prevent access to the page. If CNAME-cloaked trackers are used to redirect the user to an end resource, blocking them will also affect the user experience.
To avoid unwanted behavior, trackers are separated by type of use. This lists of unique tracker domains
that disguise the real trackers by using CNAME records, can be used in any traditional content blocker:

**Ads** – these trackers are used to distribute advertising content.
They are commonly employed to deliver targeted advertisements to users based on their browsing habits and interests.

**Clickthroughs** – this type of tracker is responsible for redirecting users to a specific target domain.
These clickthroughs, which can be numerous, can result in data being collected by third parties.

**Microsites** – microsites are separate web pages or small sections, such as iframes or widgets.
They are typically embedded within other websites and provide suggestions or recommendations.

**Trackers** – trackers of this type are used to collect and analyze information about the user.
They monitor user behavior, such as browsing patterns, interactions, and preferences,
and are used for various purposes like audience profiling, market research, and personalization.
​
> **Recommendation:**
>
> Just use "AdGuard Tracking Protection filter" or "EasyPrivacy" in a content blocker of your choice.
> This would be the safest way.
​
If you are absolutely sure you want to block all disguised trackers even if it breaks some websites, choose one of these:
​
* `AdGuard CNAME original trackers list` — the list of trackers that are often disguised using CNAME.
This list is supposed to be used only by Software capable of scanning CNAME records.
    * [Adblock-style syntax](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#adblock-style):
​
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_original_trackers.txt
        ```
​
* `AdGuard CNAME disguised lists` — the lists of unique tracker domains
that disguise the real trackers by using CNAME records. Use in any traditional content blocker.
​
    * [Adblock-style syntax](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#adblock-style):

        Ads
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads.txt
        ```
        Clickthroughs
​
        ```
         https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs.txt
        ```
        Microsites
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites.txt
        ```
        Trackers
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers.txt
        ```

    * [Just domain names](https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#domains-only-syntax):

        Ads
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads_justdomains.txt
        ```
        Clickthroughs
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs_justdomains.txt
        ```
        Microsites
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites_justdomains.txt
        ```
        Trackers
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers_justdomains.txt
        ```

If you run your own DNS server which supports [Response Policy Zones (RPZ)](https://www.dnsrpz.info),
use the data in RPZ format:
​
* `AdGuard CNAME disguised lists` - the lists of unique tracker domains
that disguise the real trackers by using CNAME records. Use with a compatible DNS server implementation.
    * RPZ format:

        Ads
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads_rpz.txt
        ```
        Clickthroughs
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs_rpz.txt
        ```
        Microsites
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites_rpz.txt
        ```
        Trackers
        ```
        https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers_rpz.txt
        ```
​
You will need to prepend your own SOA and NS records. Consult the documentation of your DNS server
and/or the [IETF Draft](https://datatracker.ietf.org/doc/draft-vixie-dnsop-dns-rpz/) for more information.