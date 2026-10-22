use std::collections::BTreeSet;

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

pub const SOURCES: [Source; 8] = [
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
    Source {
        id: "aljazeera",
        name: "Al Jazeera English",
        feed: "https://www.aljazeera.com/xml/rss/all.xml",
        interval_seconds: 180,
        max_articles: 25,
        require_region_match: true,
    },
    Source {
        id: "omanobserver",
        name: "Oman Observer",
        feed: "https://www.omanobserver.om/rssFeed/home-page",
        interval_seconds: 240,
        max_articles: 24,
        require_region_match: false,
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
                    | "www.aljazeera.com"
                    | "www.omanobserver.om"
            )
        )
        && url.username().is_empty()
        && url.password().is_none()
}

const COUNTRY_MENTION_ALIASES: &[(&str, &str)] = &[
    ("algeria", "DZ"),
    ("algerian", "DZ"),
    ("algerians", "DZ"),
    ("bahrain", "BH"),
    ("bahraini", "BH"),
    ("bahrainis", "BH"),
    ("manama", "BH"),
    ("djibouti", "DJ"),
    ("djiboutian", "DJ"),
    ("djiboutians", "DJ"),
    ("djibouti city", "DJ"),
    ("egypt", "EG"),
    ("egyptian", "EG"),
    ("egyptians", "EG"),
    ("cairo", "EG"),
    ("alexandria", "EG"),
    ("eritrea", "ER"),
    ("eritrean", "ER"),
    ("eritreans", "ER"),
    ("asmara", "ER"),
    ("iran", "IR"),
    ("iranian", "IR"),
    ("iranians", "IR"),
    ("tehran", "IR"),
    ("iraq", "IQ"),
    ("iraqi", "IQ"),
    ("iraqis", "IQ"),
    ("baghdad", "IQ"),
    ("israel", "IL"),
    ("israeli", "IL"),
    ("israelis", "IL"),
    ("tel aviv", "IL"),
    ("jerusalem", "IL"),
    ("jerusalem", "PS"),
    ("jordan", "JO"),
    ("jordanian", "JO"),
    ("jordanians", "JO"),
    ("amman", "JO"),
    ("kuwait", "KW"),
    ("kuwaiti", "KW"),
    ("kuwaitis", "KW"),
    ("kuwait city", "KW"),
    ("lebanon", "LB"),
    ("lebanese", "LB"),
    ("beirut", "LB"),
    ("libya", "LY"),
    ("libyan", "LY"),
    ("libyans", "LY"),
    ("mauritania", "MR"),
    ("mauritanian", "MR"),
    ("mauritanians", "MR"),
    ("nouakchott", "MR"),
    ("morocco", "MA"),
    ("moroccan", "MA"),
    ("moroccans", "MA"),
    ("rabat", "MA"),
    ("casablanca", "MA"),
    ("oman", "OM"),
    ("omani", "OM"),
    ("omanis", "OM"),
    ("muscat", "OM"),
    ("palestine", "PS"),
    ("palestinian territories", "PS"),
    ("occupied palestinian territory", "PS"),
    ("palestinian", "PS"),
    ("palestinians", "PS"),
    ("west bank and gaza", "PS"),
    ("west bank", "PS"),
    ("gaza", "PS"),
    ("rafah", "PS"),
    ("ramallah", "PS"),
    ("qatar", "QA"),
    ("qatari", "QA"),
    ("qataris", "QA"),
    ("doha", "QA"),
    ("saudi arabia", "SA"),
    ("saudi", "SA"),
    ("saudis", "SA"),
    ("ksa", "SA"),
    ("riyadh", "SA"),
    ("jeddah", "SA"),
    ("somalia", "SO"),
    ("somali", "SO"),
    ("somalis", "SO"),
    ("mogadishu", "SO"),
    ("sudan", "SD"),
    ("sudanese", "SD"),
    ("khartoum", "SD"),
    ("syria", "SY"),
    ("syrian arab republic", "SY"),
    ("syrian", "SY"),
    ("syrians", "SY"),
    ("damascus", "SY"),
    ("aleppo", "SY"),
    ("tunisia", "TN"),
    ("tunisian", "TN"),
    ("tunisians", "TN"),
    ("tunis", "TN"),
    ("turkiye", "TR"),
    ("türkiye", "TR"),
    ("turkey", "TR"),
    ("turkish", "TR"),
    ("ankara", "TR"),
    ("istanbul", "TR"),
    ("united arab emirates", "AE"),
    ("uae", "AE"),
    ("emirati", "AE"),
    ("emiratis", "AE"),
    ("dubai", "AE"),
    ("abu dhabi", "AE"),
    ("yemen", "YE"),
    ("yemeni", "YE"),
    ("yemenis", "YE"),
    ("sanaa", "YE"),
    ("sana a", "YE"),
    ("aden", "YE"),
    ("western sahara", "EH"),
    ("sahrawi arab democratic republic", "EH"),
    ("sahrawi", "EH"),
    ("cyprus", "CY"),
    ("cypriot", "CY"),
    ("cypriots", "CY"),
    ("nicosia", "CY"),
];

fn normalize_country_text(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Returns country-relevance tags from publisher text without claiming that a
/// mention is the article's precise geographic location.
pub(super) fn country_codes_from_text(text: &str) -> Vec<String> {
    let normalized = format!(" {} ", normalize_country_text(text));
    let mut codes = BTreeSet::new();
    for (alias, code) in COUNTRY_MENTION_ALIASES {
        let needle = format!(" {alias} ");
        if normalized.contains(needle.as_str()) {
            codes.insert((*code).to_string());
        }
    }
    codes.into_iter().collect()
}

pub fn is_mena_relevant(text: &str) -> bool {
    if !country_codes_from_text(text).is_empty() {
        return true;
    }
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
        assert_eq!(
            country_codes_from_text("Egyptian aid reaches Gaza after talks with Israeli officials"),
            vec!["EG", "IL", "PS"]
        );
        assert!(country_codes_from_text("German local politics").is_empty());
        assert!(is_mena_relevant("Iranian markets trade overseas"));
    }

    #[test]
    fn feed_hosts_are_allowlisted() {
        assert!(approved_feed_host(
            &Url::parse("https://rss.dw.com/xml/rss-en-all").unwrap()
        ));
        for source in SOURCES {
            assert!(approved_feed_host(&Url::parse(source.feed).unwrap()), "{}", source.id);
        }
        assert!(!approved_feed_host(
            &Url::parse("https://evil.example/rss").unwrap()
        ));
        assert!(!approved_feed_host(
            &Url::parse("http://www.aa.com.tr/en/rss").unwrap()
        ));
    }
}
