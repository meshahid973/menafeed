use reqwest::Url;

#[derive(Clone, Copy)]
pub struct Source {
    pub id: &'static str,
    pub name: &'static str,
    pub feed: &'static str,
    pub interval_seconds: i64,
    pub max_articles: usize,
    pub require_region_match: bool,
}

pub const SOURCES: [Source; 6] = [
    Source {
        id: "bbc",
        name: "BBC Middle East",
        feed: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
        interval_seconds: 120,
        max_articles: 30,
        require_region_match: false,
    },
    Source {
        id: "france24",
        name: "France 24",
        feed: "https://www.france24.com/en/middle-east/rss",
        interval_seconds: 120,
        max_articles: 30,
        require_region_match: false,
    },
    Source {
        id: "mem",
        name: "Middle East Monitor",
        feed: "https://www.middleeastmonitor.com/feed/",
        interval_seconds: 180,
        max_articles: 30,
        require_region_match: false,
    },
    Source {
        id: "anadolu",
        name: "Anadolu Agency",
        feed: "https://www.aa.com.tr/en/rss/default?",
        interval_seconds: 180,
        max_articles: 24,
        require_region_match: true,
    },
    Source {
        id: "africanews",
        name: "Africanews",
        feed: "https://www.africanews.com/feed/rss",
        interval_seconds: 300,
        max_articles: 24,
        require_region_match: true,
    },
    Source {
        id: "dw",
        name: "Deutsche Welle",
        feed: "https://rss.dw.com/xml/rss-en-all",
        interval_seconds: 300,
        max_articles: 24,
        require_region_match: true,
    },
];

pub fn approved_feed_host(url: &Url) -> bool {
    url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some(
                "feeds.bbci.co.uk"
                    | "www.france24.com"
                    | "www.middleeastmonitor.com"
                    | "www.aa.com.tr"
                    | "aa.com.tr"
                    | "www.africanews.com"
                    | "africanews.com"
                    | "rss.dw.com"
            )
        )
        && url.username().is_empty()
        && url.password().is_none()
}

pub fn is_mena_relevant(text: &str) -> bool {
    let input = format!(
        " {} ",
        text.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { ' ' })
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    );
    const TERMS: &[&str] = &[
        "middle east",
        "north africa",
        "maghreb",
        "arab gulf",
        "red sea",
        "west bank",
        "morocco",
        "algeria",
        "tunisia",
        "libya",
        "egypt",
        "sudan",
        "mauritania",
        "saudi",
        "oman",
        "yemen",
        "bahrain",
        "qatar",
        "kuwait",
        "emirates",
        "uae",
        "palestine",
        "gaza",
        "israel",
        "lebanon",
        "syria",
        "jordan",
        "iraq",
        "iran",
        "turkey",
        "türkiye",
        "tehran",
        "beirut",
        "cairo",
        "riyadh",
        "khartoum",
        "doha",
        "abu dhabi",
        "dubai",
        "muscat",
        "jerusalem",
        "tripoli",
    ];
    TERMS
        .iter()
        .any(|term| input.contains(&format!(" {term} ")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn global_feeds_only_match_regional_stories() {
        assert!(is_mena_relevant("Talks held in Bahrain and Saudi Arabia"));
        assert!(is_mena_relevant("North Africa economy"));
        assert!(!is_mena_relevant("German local politics"));
        assert!(!is_mena_relevant("Iranian markets trade overseas"));
    }

    #[test]
    fn feed_hosts_are_allowlisted() {
        assert!(approved_feed_host(
            &Url::parse("https://rss.dw.com/xml/rss-en-all").unwrap()
        ));
        assert!(!approved_feed_host(
            &Url::parse("https://evil.example/rss").unwrap()
        ));
        assert!(!approved_feed_host(
            &Url::parse("http://www.aa.com.tr/en/rss").unwrap()
        ));
    }
}
