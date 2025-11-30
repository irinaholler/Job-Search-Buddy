import { useState, useRef, useEffect } from "react";
import "./App.css";
import { translations } from "./i18n";
import iraLogo from "./assets/ira-logo.png";

// === NEU: pdfjs für PDF-Text ===
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Hilfsfunktion: PDF -> Text
async function readPdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += pageText + "\n\n";
  }
  return text;
}

// Extract skill keywords directly from CV text (no fixed list)
// Extract skill keywords directly from CV text (no fixed list)
function extractSkillsFromCv(cvText) {
  const text = cvText.replace(/\r/g, "");
  const lines = text.split("\n");

  // Try to find a "Skills / Kenntnisse / Kompetenzen" section
  const headingRegex =
    /(skills|kenntnisse|kompetenzen|tech stack|technologien|fähigkeiten)/i;

  const stopwords = new Set([
    "and",
    "or",
    "the",
    "a",
    "an",
    "of",
    "with",
    "in",
    "im",
    "am",
    "zu",
    "zum",
    "zur",
    "von",
    "vom",
    "und",
    "oder",
    "mit",
    "für",
    "auf",
    "bei",
    "als",
    "der",
    "die",
    "das",
    "den",
    "dem",
    "ein",
    "eine",
    "einer",
    "einem",
    "berufserfahrung",
    "experience",
    "education",
    "ausbildung",
    "projects",
    "projekte",
    "languages",
    "sprachen",
    "skills",
    "kenntnisse",
    "kompetenzen",
    // Common non-skill words to exclude
    "webentwicklerin",
    "entwicklerin",
    "developer",
    "entwickler",
    "sinnvolle",
    "tech",
    "technologien",
    "sinn",
  ]);

  // Common technical skill patterns that should be preserved
  const techSkillPatterns = [
    /\b(html|html5|css|css3|javascript|js|typescript|ts|react|vue|angular|svelte|node\.js|nodejs|mongodb|express|bootstrap|tailwind|sass|scss|python|java|php|ruby|go|golang|rust|c#|c\+\+|sql|mysql|postgresql|redis|docker|kubernetes|aws|azure|gcp|git|github|gitlab|figma|adobe|photoshop|illustrator|wordpress|mern|mean|mevn|fullstack|frontend|backend|api|rest|graphql|ux|ui|ux\/ui)\b/i,
    /\b(agile|scrum|tdd|bdd|devops|ci\/cd|microservices)\b/i,
  ];


  let block = "";
  let fromSkillsSection = false;
  let originalBlock = ""; // Keep original for tech keyword search

  // 1) Try to find explicit Skills section first
  const headingIndex = lines.findIndex((line) => headingRegex.test(line));
  if (headingIndex !== -1) {
    const collected = [];
    for (let i = headingIndex + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) break; // empty line → end of block
      // next big ALLCAPS heading like EXPERIENCE / BERUFSERFAHRUNG
      if (/^[A-ZÄÖÜ][A-ZÄÖÜ\s\-]{4,}$/.test(l)) break;
      collected.push(l);
    }
    block = collected.join(" ");
    fromSkillsSection = true;
  } else {
    // Fallback: Search entire CV for known tech terms only (not random words)
    // This is safer - we only extract known technical keywords
    block = text;
    fromSkillsSection = false;
  }

  // Keep original block before cleaning (for better keyword detection)
  originalBlock = block;

  // Filter out dates, numbers, URLs, emojis, etc. BEFORE splitting
  // BUT preserve tech terms even if they contain special chars
  block = block
    .replace(/\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g, " ") // Replace dates with space (don't break words)
    .replace(/\d{1,2}[\/\-\.]\d{1,4}/g, " ") // Replace date fragments
    .replace(/\b\d{4}\b/g, " ") // Replace year numbers with space
    .replace(/https?:\/\/[^\s]+/gi, " ") // Remove URLs
    .replace(/[^\w\s,;•·\u2022\/\-\u2013\|\(\)]/g, " ") // Replace emojis/special chars with space (preserve tech terms)
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  let rawTokens = [];

  if (fromSkillsSection) {
    // 2a) If from Skills section: Split by typical separators
    rawTokens = block
      .split(/[,;•·\u2022\/\-\u2013\|\(\)]+/)
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
  } else {
    // 2b) If from whole CV: Only extract known tech keywords (safer approach)
    const knownTechKeywords = [
      "html", "html5", "css", "css3", "javascript", "js", "typescript", "ts",
      "react", "vue", "angular", "svelte", "next.js", "nextjs", "nuxt",
      "node.js", "nodejs", "node js", "express", "nestjs", "django", "flask", "fastapi",
      "mongodb", "mongo db", "mysql", "postgresql", "postgres", "redis", "sql",
      "bootstrap", "tailwind", "tailwindcss", "sass", "scss",
      "python", "java", "php", "ruby", "go", "golang", "rust", "c#", "csharp", "c++", "cpp",
      "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "git", "github", "gitlab",
      "wordpress", "word press", "wp", "mern", "mern-stack", "mernstack", "mean", "mevn",
      "fullstack", "full-stack", "full stack", "frontend", "front-end", "backend", "back-end",
      "api", "rest", "rest api", "graphql",
      "ux", "ui", "ux/ui", "ui/ux", "figma", "adobe", "photoshop", "illustrator",
      "agile", "scrum", "tdd", "bdd", "devops", "ci/cd", "cicd"
    ];

    // Search for known tech keywords in the CV text
    const foundKeywords = new Set();
    const textLower = block.toLowerCase();

    // Use original block (before cleaning) for better keyword detection
    const searchText = originalBlock || block;
    const searchTextLower = searchText.toLowerCase();

    knownTechKeywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();

      // First try exact word boundary match
      let regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(searchText)) {
        foundKeywords.add(keyword);
      } else {
        // Also check for compound words (e.g., "MERNStack" contains "mern")
        // Remove special chars for compound word matching
        const keywordClean = keywordLower.replace(/[^a-z0-9]/g, '');
        if (keywordClean.length >= 3) {
          // Search for keyword as part of compound word (case insensitive)
          // Also check variations like "mernstack", "mern-stack", "mern stack"
          const variations = [
            keywordClean,
            keywordClean + 'stack',
            keywordClean + '-stack',
            keywordClean + 'stack',
          ];

          for (const variant of variations) {
            if (searchTextLower.includes(variant)) {
              foundKeywords.add(keyword);
              break;
            }
          }
        }
      }
    });

    rawTokens = Array.from(foundKeywords);
  }

  // 3) Filter and clean all tokens
  rawTokens = rawTokens
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter(s => {
      const low = s.toLowerCase();

      // Filter out dates and numbers
      if (/^\d+$/.test(s.trim())) return false;
      if (/^\d{1,2}[\/\-\.]/.test(s)) return false;

      // Filter out very short or very long
      if (s.trim().length < 2 || s.trim().length > 30) return false;

      // Filter out stopwords (but allow tech terms even if they're stopwords)
      if (stopwords.has(low) && !techSkillPatterns.some(pattern => pattern.test(s))) return false;

      // Filter out broken words (too many single letters)
      const singleCharWords = s.split(/\s+/).filter(w => w.length === 1).length;
      if (singleCharWords > 2) return false;

      // Filter out URLs or email-like patterns
      if (/[@:]/.test(s)) return false;

      return true;
    });

  // If still nothing, return empty
  if (!rawTokens.length) {
    return [];
  }

  // 4) Clean up, remove stopwords + duplicates, make labels nice
  const skills = [];
  const seen = new Set();

  for (const token of rawTokens) {
    let trimmed = token.trim();
    if (!trimmed) continue;

    // Remove extra spaces and fix broken words
    trimmed = trimmed.replace(/\s+/g, " ").trim();

    // Final length check
    if (trimmed.length < 2 || trimmed.length > 30) continue;

    // Final check for numbers/dates
    if (/^\d+$/.test(trimmed) || /^\d+[\/\-\.]/.test(trimmed)) continue;

    const low = trimmed.toLowerCase();

    // Skip stopwords
    if (stopwords.has(low)) continue;

    // Skip if it contains URLs or special patterns
    if (/[@:]/.test(trimmed)) continue;

    // Skip broken words (has single character "words" separated by spaces)
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const singleCharParts = parts.filter(p => p.length === 1);
      if (singleCharParts.length > 0) continue; // Has single-char "words" = broken
    }

    // Skip if it looks like a name (two capitalized words not matching tech patterns)
    // Names typically: Firstname Lastname (both start with capital, common name patterns)
    if (parts.length === 2 && parts.every(p => /^[A-ZÄÖÜ][a-zäöü]{2,}$/.test(p))) {
      // Check if it's a known tech term (like "React Native", "Full Stack")
      const isTechTerm = techSkillPatterns.some(pattern => pattern.test(trimmed)) ||
        /^(react native|full stack|mean stack|mern stack|mevn stack)$/i.test(trimmed);
      if (!isTechTerm) {
        continue; // Likely a personal name
      }
    }

    // Skip single capitalized words that might be names (unless they're tech terms)
    if (parts.length === 1 && /^[A-ZÄÖÜ][a-zäöü]{3,}$/.test(trimmed)) {
      const isTechTerm = techSkillPatterns.some(pattern => pattern.test(trimmed)) ||
        /^(react|vue|angular|python|java|html|css|javascript|typescript|mongodb|express|node|bootstrap|tailwind|figma|adobe|wordpress|git|docker|aws|azure|gcp)$/i.test(trimmed);
      if (!isTechTerm && trimmed.length > 4) {
        continue; // Might be a name
      }
    }

    // Skip if it starts with a stopword
    if (parts.length >= 2 && stopwords.has(parts[0].toLowerCase())) continue;

    if (seen.has(low)) continue;
    seen.add(low);

    let label = trimmed;

    // Normalize common tech terms
    if (low === "mern" || low === "mern-stack") label = "MERN Stack";
    else if (low === "mean") label = "MEAN Stack";
    else if (low === "mevn") label = "MEVN Stack";
    else if (low === "wordpress" || low === "word press") label = "WordPress";
    else if (low === "nodejs" || low === "node js") label = "Node.js";
    else if (low === "javascript" || low === "js") label = "JavaScript";
    else if (low === "typescript" || low === "ts") label = "TypeScript";
    else if (low === "html5" || low === "html") label = "HTML5";
    else if (low === "css3" || low === "css") label = "CSS3";
    else if (low === "fullstack" || low === "full stack") label = "Full Stack";
    else if (low === "frontend" || low === "front-end") label = "Frontend";
    else if (low === "backend" || low === "back-end") label = "Backend";
    else {
      // small beautify: if completely lowercase → capitalize first letter
      if (label === label.toLowerCase()) {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    }

    skills.push(label);
    if (skills.length >= 20) break; // don't explode
  }

  return skills;
}

// Enhanced CV extraction with better parsing
// Enhanced CV extraction with better parsing + richer job titles
function extractFromCv(cvText) {
  const lower = cvText.toLowerCase();
  // Don't auto-extract skills - let users enter them manually
  const skills = [];

  // --- Experience level ---
  let experienceLevel = "Mid-level";
  if (
    lower.includes("junior") ||
    lower.includes("entry") ||
    lower.includes("trainee") ||
    lower.includes("praktikant") ||
    lower.includes("praktikum") ||
    lower.includes("intern") ||
    lower.includes("bootcamp") ||
    lower.includes("student")
  ) {
    experienceLevel = "Junior";
  } else if (
    lower.includes("senior") ||
    lower.includes("lead") ||
    lower.includes("principal") ||
    lower.includes("architect")
  ) {
    experienceLevel = "Senior";
  } else {
    const yearsMatch = cvText.match(/(\d+)\+?\s*(years?|jahre)/i);
    if (yearsMatch) {
      const years = parseInt((yearsMatch[1] || "0").toString(), 10);
      if (years >= 5) experienceLevel = "Senior";
      else if (years <= 2) experienceLevel = "Junior";
    }
  }

  // --- Languages ---
  const languages = [];
  const languagePatterns = [
    { pattern: /english|englisch/i, name: "English" },
    { pattern: /german|deutsch/i, name: "German" },
    { pattern: /spanish|spanisch/i, name: "Spanish" },
    { pattern: /french|französisch/i, name: "French" },
  ];
  languagePatterns.forEach(({ pattern, name }) => {
    if (pattern.test(cvText) && !languages.includes(name)) {
      languages.push(name);
    }
  });

  // --- Remote preference (info only) ---
  const prefersRemote =
    lower.includes("remote") ||
    lower.includes("homeoffice") ||
    lower.includes("home office") ||
    lower.includes("work from home");

  // --- Location hint ---
  let locationHint = "";
  const locationRegex =
    /(?:in|at|from|based in|located in)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]+)?)/g;
  const locMatches = cvText.match(locationRegex);
  if (locMatches && locMatches.length > 0) {
    const last = locMatches[locMatches.length - 1];
    const cityMatch = last.match(
      /(?:in|at|from|based in|located in)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]+)?)/
    );
    if (cityMatch && cityMatch[1]) {
      locationHint = cityMatch[1];
    }
  }

  // --- Heuristics for directions & roles ---
  const titles = new Set();
  const directions = new Set();
  const altSuggestions = new Set();

  const hasReact = lower.includes("react");
  const hasTs =
    lower.includes("typescript") || /\bts\b/.test(lower);
  const hasJs =
    lower.includes("javascript") || /\bjs\b/.test(lower);
  const hasFrontend =
    lower.includes("frontend") ||
    lower.includes("front-end") ||
    lower.includes("frontend-entwickler") ||
    lower.includes("frontend entwickler") ||
    lower.includes("frontend entwicklerin");

  const hasBackend =
    lower.includes("backend") ||
    lower.includes("back-end") ||
    lower.includes("api") ||
    lower.includes("server") ||
    lower.includes("node.js") ||
    lower.includes("nodejs") ||
    lower.includes("express");
  const hasNode = lower.includes("node.js") || lower.includes("nodejs") || lower.includes("node js");

  const hasMern =
    lower.includes("mern") ||
    lower.includes("mongodb") ||
    lower.includes("mongo db") ||
    lower.includes("node.js") ||
    lower.includes("express") ||
    lower.includes("react");

  const hasWordpress =
    lower.includes("wordpress") || lower.includes("elementor");

  const hasDesign =
    lower.includes("figma") ||
    lower.includes("adobe") ||
    lower.includes("photoshop") ||
    lower.includes("illustrator") ||
    lower.includes("indesign") ||
    lower.includes("design");

  const hasUXUI =
    /\bux\b/.test(lower) ||
    /\bui\b/.test(lower) ||
    lower.includes("ux/ui") ||
    lower.includes("user experience") ||
    lower.includes("user interface");

  // More strict AI detection - avoid triggering on "AI Development in training" or just mentions
  const hasAI =
    (lower.includes("ai") && !lower.includes("in weiterbildung") && !lower.includes("in training") && !lower.includes("aktuell in")) ||
    lower.includes("künstliche intelligenz") ||
    lower.includes("prompt engineer") ||
    lower.includes("prompt engineering") ||
    lower.includes("chatgpt") ||
    lower.includes("gpt") ||
    (lower.includes("machine learning") && !lower.includes("in weiterbildung") && !lower.includes("in training")) ||
    (/\bml\b/.test(lower) && !lower.includes("in weiterbildung") && !lower.includes("in training"));

  const hasContent =
    lower.includes("content") ||
    lower.includes("texte") ||
    lower.includes("copywriting") ||
    lower.includes("redaktion") ||
    lower.includes("blog");

  const hasWebDevWord =
    lower.includes("webentwickler") ||
    lower.includes("webentwicklerin") ||
    lower.includes("web developer");

  // --- Extended tech stack detection ---
  const hasPython = lower.includes("python") || /\bpy\b/.test(lower);
  const hasJava = lower.includes("java") || /\bjava\b/.test(lower);
  const hasGo = lower.includes(" golang") || /\bgo\b/.test(lower) || lower.includes("go language");
  const hasRust = lower.includes("rust");
  const hasCSharp = lower.includes("c#") || lower.includes("csharp") || lower.includes(".net");
  const hasDotNet = lower.includes(".net") || lower.includes("dotnet") || lower.includes("asp.net");
  const hasPHP = lower.includes("php");
  const hasRuby = lower.includes("ruby") || lower.includes("rails");
  const hasScala = lower.includes("scala");
  const hasKotlin = lower.includes("kotlin");
  const hasSwift = lower.includes("swift");
  const hasFlutter = lower.includes("flutter");
  const hasDart = lower.includes("dart");

  // Databases
  const hasPostgres = lower.includes("postgres") || lower.includes("postgresql");
  const hasMongo = lower.includes("mongodb") || lower.includes("mongo db");
  const hasMySQL = lower.includes("mysql");
  const hasRedis = lower.includes("redis");
  const hasElasticsearch = lower.includes("elasticsearch") || lower.includes("elastic");
  const hasCassandra = lower.includes("cassandra");
  const hasOracle = lower.includes("oracle");
  const hasSQLServer = lower.includes("sql server");

  // Cloud & DevOps
  const hasAWS = lower.includes("aws") || lower.includes("amazon web services");
  const hasAzure = lower.includes("azure");
  const hasGCP = lower.includes("gcp") || lower.includes("google cloud") || lower.includes("google cloud platform");
  const hasDocker = lower.includes("docker");
  const hasKubernetes = lower.includes("kubernetes") || lower.includes("k8s");
  const hasTerraform = lower.includes("terraform");
  const hasAnsible = lower.includes("ansible");
  const hasJenkins = lower.includes("jenkins");
  const hasCI = lower.includes("ci/cd") || lower.includes("continuous integration");
  const hasDevOps = lower.includes("devops") || lower.includes("dev ops");
  const hasSRE = lower.includes("sre") || lower.includes("site reliability");

  // Data Science & ML
  const hasDataScience = lower.includes("data science") || lower.includes("data scientist");
  const hasML = lower.includes("machine learning") || /\bml\b/.test(lower);
  const hasTensorFlow = lower.includes("tensorflow");
  const hasPyTorch = lower.includes("pytorch");
  const hasPandas = lower.includes("pandas");
  const hasNumPy = lower.includes("numpy");
  const hasScikit = lower.includes("scikit") || lower.includes("sklearn");
  const hasDataEngineering = lower.includes("data engineer") || lower.includes("data engineering");
  const hasBigData = lower.includes("big data") || lower.includes("hadoop") || lower.includes("spark");
  const hasSpark = lower.includes("spark") || lower.includes("apache spark");
  const hasAnalytics = lower.includes("data analytics") || lower.includes("data analyst");

  // Security
  const hasSecurity = lower.includes("cybersecurity") || lower.includes("cyber security") ||
    lower.includes("security engineer") || lower.includes("penetration testing") ||
    lower.includes("pen testing") || lower.includes("pentest");

  // Mobile
  const hasAndroid = lower.includes("android");
  const hasIOS = lower.includes("ios") || lower.includes("iphone");
  const hasReactNative = lower.includes("react native") || lower.includes("react-native");
  const hasMobile = lower.includes("mobile developer") || lower.includes("mobile development");

  // Game Development
  const hasUnity = lower.includes("unity");
  const hasUnreal = lower.includes("unreal");
  const hasGameDev = lower.includes("game developer") || lower.includes("game development");

  // Blockchain
  const hasBlockchain = lower.includes("blockchain") || lower.includes("ethereum") ||
    lower.includes("solidity") || lower.includes("web3");

  // Embedded / IoT - more strict, avoid false positives from "mobile communication"
  const hasEmbedded =
    lower.includes("embedded") ||
    (lower.includes("iot") && !lower.includes("mobile communication") && !lower.includes("mobile-kommunikation")) ||
    lower.includes("internet of things") ||
    lower.includes("arduino") ||
    lower.includes("raspberry pi") ||
    (lower.includes("embedded systems") && !lower.includes("communication"));

  // Only detect C/C++ if in context of programming, not just mentions
  const hasCpp =
    (lower.includes("c++") || lower.includes("cpp") || lower.includes("cplusplus")) &&
    (lower.includes("developer") || lower.includes("programming") || lower.includes("entwickler") || lower.includes("software"));
  const hasC =
    (lower.includes(" c ") || /\bc\b/.test(lower.replace(/c#/g, "").replace(/c\+\+/g, ""))) &&
    (lower.includes("developer") || lower.includes("programming") || lower.includes("entwickler") || lower.includes("software")) &&
    !lower.includes("communication") && !lower.includes("kommunikation");

  // --- Core titles + suggestions ---

  // Frontend / React / Webdev
  if (hasReact || hasFrontend || hasWebDevWord) {
    titles.add("Frontend Developer");
    if (hasReact) titles.add("React Developer");
    if (hasWebDevWord) titles.add("Webentwickler:in");

    if (experienceLevel === "Junior") {
      altSuggestions.add("Junior Frontend Developer");
      if (hasReact) altSuggestions.add("Junior React Developer");
    } else {
      altSuggestions.add("Frontend Engineer");
    }

    if (hasTs || hasJs) {
      altSuggestions.add("JavaScript Developer");
      if (hasTs) altSuggestions.add("React / TypeScript Developer");
    }

    directions.add("frontend-heavy");
  }

  // Backend (expanded)
  if (hasBackend || hasPython || hasJava || hasGo || hasCSharp || hasDotNet || hasNode || hasPHP || hasRuby) {
    if (!hasFrontend || (hasBackend && hasFrontend)) {
      titles.add("Backend Developer");
      directions.add("backend-heavy");
    }

    if (hasPython && !hasDataScience && !hasML && !hasAI) {
      titles.add("Python Developer");
      altSuggestions.add("Backend Developer (Python)");
    }
    if (hasJava) {
      titles.add("Java Developer");
      altSuggestions.add("Backend Developer (Java)");
    }
    if (hasGo) {
      titles.add("Go Developer");
      altSuggestions.add("Backend Developer (Go)");
    }
    if (hasCSharp || hasDotNet) {
      titles.add(".NET Developer");
      altSuggestions.add("C# Developer");
      altSuggestions.add("Backend Developer (.NET)");
    }
    if (hasPHP) {
      titles.add("PHP Developer");
    }
    if (hasRuby) {
      titles.add("Ruby Developer");
      altSuggestions.add("Ruby on Rails Developer");
    }
    if (hasNode) {
      titles.add("Node.js Developer");
    }
  }

  // Fullstack / MERN
  if (hasMern || (hasFrontend && hasBackend)) {
    titles.add("Full Stack Developer");
    if (hasMern) {
      altSuggestions.add("Full Stack Developer (MERN)");
      altSuggestions.add("MERN Stack Developer");
    }
    directions.add("fullstack");
  }

  // Data Science & ML - only if there's actual experience, not just "in training"
  // Check for actual ML/Data Science keywords, not just "AI" mentions
  const hasRealMLExperience =
    hasTensorFlow || hasPyTorch || hasPandas || hasNumPy || hasScikit ||
    (hasML && !lower.includes("in weiterbildung") && !lower.includes("in training") && !lower.includes("aktuell in")) ||
    (hasDataScience && !lower.includes("in weiterbildung") && !lower.includes("in training"));

  if (hasRealMLExperience || hasDataEngineering || hasBigData || hasSpark) {
    if (hasRealMLExperience || hasDataScience) {
      titles.add("Data Scientist");
      if (hasML && !lower.includes("in weiterbildung") && !lower.includes("in training")) {
        titles.add("Machine Learning Engineer");
        altSuggestions.add("ML Engineer");
      }
    }
    if (hasDataEngineering || hasBigData || hasSpark) {
      titles.add("Data Engineer");
      altSuggestions.add("Big Data Engineer");
    }
    if (hasAnalytics) {
      titles.add("Data Analyst");
    }
    directions.add("data-heavy");
  }

  // AI Content roles (lighter than ML Engineer - for content/prompt work)
  if (hasAI && !hasRealMLExperience) {
    // Only suggest AI Content roles, not ML Engineer, if it's just AI content/prompt work
    titles.add("AI Content / Prompt Specialist");
    altSuggestions.add("AI Content Strategist");
    altSuggestions.add("Prompt Engineer");
    directions.add("ai-heavy");
  }

  // DevOps / SRE
  if (hasDevOps || hasSRE || hasDocker || hasKubernetes || hasAWS || hasAzure || hasGCP || hasTerraform || hasAnsible || hasJenkins || hasCI) {
    titles.add("DevOps Engineer");
    if (hasSRE) {
      titles.add("Site Reliability Engineer");
    }
    if (hasKubernetes || hasDocker) {
      altSuggestions.add("Platform Engineer");
      altSuggestions.add("Cloud Engineer");
    }
    if (hasAWS || hasAzure || hasGCP) {
      altSuggestions.add("Cloud Engineer");
      altSuggestions.add("Cloud Architect");
    }
    directions.add("devops-heavy");
  }

  // Security
  if (hasSecurity) {
    titles.add("Security Engineer");
    altSuggestions.add("Cybersecurity Specialist");
    altSuggestions.add("Penetration Tester");
    directions.add("security-heavy");
  }

  // Mobile
  if (hasMobile || hasAndroid || hasIOS || hasReactNative || hasFlutter || hasSwift || hasKotlin) {
    if (hasAndroid || hasKotlin) {
      titles.add("Android Developer");
    }
    if (hasIOS || hasSwift) {
      titles.add("iOS Developer");
    }
    if (hasReactNative) {
      titles.add("React Native Developer");
    }
    if (hasFlutter || hasDart) {
      titles.add("Flutter Developer");
    }
    if (!hasAndroid && !hasIOS && hasMobile) {
      titles.add("Mobile Developer");
    }
    directions.add("mobile-heavy");
  }

  // Game Development
  if (hasGameDev || hasUnity || hasUnreal) {
    titles.add("Game Developer");
    if (hasUnity) {
      altSuggestions.add("Unity Developer");
    }
    if (hasUnreal) {
      altSuggestions.add("Unreal Engine Developer");
    }
    directions.add("gamedev-heavy");
  }

  // Blockchain
  if (hasBlockchain) {
    titles.add("Blockchain Developer");
    altSuggestions.add("Web3 Developer");
    altSuggestions.add("Solidity Developer");
    directions.add("blockchain-heavy");
  }

  // Embedded / IoT - only if there's clear embedded/IoT experience
  // Avoid false positives from "mobile communication" in education
  if (hasEmbedded) {
    titles.add("Embedded Systems Engineer");
    altSuggestions.add("IoT Developer");
    directions.add("embedded-heavy");
  } else if (hasCpp || hasC) {
    // Only suggest embedded if C/C++ is mentioned with embedded context
    if (lower.includes("embedded") || lower.includes("systems") || lower.includes("firmware")) {
      titles.add("Embedded Systems Engineer");
      if (hasCpp) {
        altSuggestions.add("C++ Developer");
      }
      directions.add("embedded-heavy");
    }
  }

  // WordPress / Webdesign
  if (hasWordpress) {
    titles.add("Webdesigner (WordPress)");
    altSuggestions.add("WordPress Developer");
    altSuggestions.add("Webentwickler:in (WordPress)");
    directions.add("design-heavy");
  }

  // Design / UX/UI
  if (hasDesign) {
    titles.add("Digital Designer");
    if (hasUXUI || hasFrontend) {
      titles.add("UX/UI Designer");
    }
    altSuggestions.add("Product Designer");
    altSuggestions.add("Visual Designer");
    directions.add("design-heavy");
  }

  // AI / Prompt / Content - this is now handled above in the ML section

  if (hasContent) {
    altSuggestions.add("Content Creator");
    altSuggestions.add("Content Writer");
    if (hasAI) altSuggestions.add("AI-assisted Content Creator");
  }

  // QA / Testing
  if (
    lower.includes("qa") ||
    lower.includes("quality assurance") ||
    lower.includes("testing") ||
    lower.includes("test automation") ||
    lower.includes("jest") ||
    lower.includes("cypress") ||
    lower.includes("selenium")
  ) {
    titles.add("QA Engineer");
    altSuggestions.add("Test Automation Engineer");
    directions.add("qa-heavy");
  }

  // Additional frameworks
  if (lower.includes("vue")) {
    titles.add("Vue.js Developer");
    if (!titles.has("Frontend Developer")) titles.add("Frontend Developer");
  }
  if (lower.includes("angular")) {
    titles.add("Angular Developer");
    if (!titles.has("Frontend Developer")) titles.add("Frontend Developer");
  }
  if (lower.includes("next.js") || lower.includes("nextjs")) {
    altSuggestions.add("Next.js Developer");
  }
  if (lower.includes("svelte")) {
    altSuggestions.add("Svelte Developer");
  }

  // Fallback if nothing found
  if (titles.size === 0) {
    titles.add("Web Developer");
    titles.add("Software Developer");
  }

  // --- Build final lists ---

  const baseTitles = Array.from(titles);
  const altList = Array.from(altSuggestions);

  // 1) Jobtitel-Textarea: base + alternatives → lots of suggestions
  const titlesArray = [...baseTitles, ...altList].slice(0, 15);

  // 2) Alternative-Titel-Block: only the extra ones
  const alternativeTitles = altList;

  const limitedSkills = skills.length > 15 ? skills.slice(0, 15) : skills;

  const directionsArray = Array.from(directions);
  if (directionsArray.length === 0) directionsArray.push("frontend-heavy");

  return {
    skills: limitedSkills.length ? limitedSkills : [],
    titles: titlesArray,
    alternativeTitles,
    directions: directionsArray,
    experienceLevel,
    languages: languages.length ? languages : ["German", "English"],
    prefersRemote,
    locationHint,
  };
}

// --- URL builders ---

// Indeed: only title + location (no skills)
function buildIndeedUrl(title, location) {
  let cleanLocation = location || "Deutschland";
  cleanLocation = cleanLocation
    .replace(/\s*(oder|or)\s+(Remote|Hybrid)/gi, "")
    .trim();
  if (!cleanLocation) cleanLocation = "Deutschland";

  const cleanTitle = title.replace(/[\/,]/g, " ").trim();

  const q = encodeURIComponent(cleanTitle);
  const l = encodeURIComponent(cleanLocation);

  return `https://de.indeed.com/jobs?q=${q}&l=${l}`;
}

// helper to make URL-friendly parts
function slugify(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// StepStone: clean, readable URL, only title + location
function buildStepstoneUrl(title, location) {
  const cleanTitle = (title || "").replace(/[\/,]/g, " ").trim() || "developer";

  let cleanLocation = location || "Deutschland";
  cleanLocation = cleanLocation
    .replace(/\s*(oder|or)\s+(Remote|Hybrid)/gi, "")
    .trim();
  if (!cleanLocation) cleanLocation = "Deutschland";

  const titleSlug = slugify(cleanTitle);
  const locationSlug = slugify(cleanLocation);

  return `https://www.stepstone.de/jobs/${encodeURIComponent(
    titleSlug
  )}/in-${encodeURIComponent(locationSlug)}`;
}

// LinkedIn: title + a couple of skills + location, no remote filter
function buildLinkedInUrl(title, location, skills) {
  let cleanLocation = location || "Deutschland";
  cleanLocation = cleanLocation
    .replace(/\s*(oder|or)\s+(Remote|Hybrid)/gi, "")
    .trim();
  if (!cleanLocation) cleanLocation = "Deutschland";

  const cleanTitle = title.replace(/[\/]/g, " ").trim();

  const keywords = [cleanTitle];
  if (skills && skills.length > 0) {
    const cleanSkills = skills
      .slice(0, 2)
      .map((s) => s.trim().replace(/[\/]/g, " "))
      .filter((s) => s.length > 0);
    keywords.push(...cleanSkills);
  }

  const keywordsEncoded = encodeURIComponent(
    keywords.filter((k) => k.trim().length > 0).join(" ")
  );
  const locationEncoded = encodeURIComponent(cleanLocation);

  return `https://www.linkedin.com/jobs/search/?keywords=${keywordsEncoded}&location=${locationEncoded}`;
}

// Custom portals: title + skills + location, no explicit work mode
function buildCustomPortalUrl(portal, title, location, skills) {
  let cleanLocation = location || "Deutschland";
  cleanLocation = cleanLocation
    .replace(/\s*(oder|or)\s+(Remote|Hybrid)/gi, "")
    .trim();
  if (!cleanLocation) cleanLocation = "Deutschland";

  const cleanTitle = title.replace(/[\/]/g, " ").trim();

  const queryParts = [cleanTitle];
  if (skills && skills.length > 0) {
    const cleanSkills = skills
      .slice(0, 2)
      .map((s) => s.trim().replace(/[\/]/g, " "))
      .filter((s) => s.length > 0);
    queryParts.push(...cleanSkills);
  }

  const query = queryParts.filter((p) => p.trim().length > 0).join(" ");

  let url = portal.url;
  url = url.replace(/\{query\}/g, encodeURIComponent(query));
  url = url.replace(/\{title\}/g, encodeURIComponent(cleanTitle));
  url = url.replace(/\{location\}/g, encodeURIComponent(cleanLocation));

  return url;
}

// Extract ONLY real technical keywords from a job ad - much smarter approach
function extractJobTokens(jobText) {
  // We ONLY extract known technical terms, not random words
  // This prevents extracting nonsense like "Haben", "Interesse", etc.

  const techKeywords = [
    // Programming Languages
    "javascript", "js", "typescript", "ts", "python", "java", "c#", "csharp", "php", "ruby",
    "go", "golang", "rust", "swift", "kotlin", "scala", "dart", "r", "sql", "html", "css",
    "c++", "cpp", "cplusplus", "c", "perl", "lua", "bash", "powershell",

    // Frameworks & Libraries
    "react", "vue", "angular", "svelte", "next.js", "nextjs", "nuxt", "gatsby",
    "node.js", "nodejs", "express", "nestjs", "django", "flask", "fastapi", "spring",
    "laravel", "symfony", "rails", "asp.net", ".net", "dotnet", "xamarin",

    // Databases
    "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch", "cassandra",
    "oracle", "sql server", "sqlite", "dynamodb", "couchdb", "neo4j",

    // Tools & Technologies
    "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "gitlab", "github",
    "git", "svn", "jira", "confluence", "slack", "aws", "azure", "gcp", "heroku",

    // Testing
    "jest", "cypress", "selenium", "playwright", "pytest", "junit", "mocha", "karma",

    // Data & ML
    "tensorflow", "pytorch", "pandas", "numpy", "scikit", "spark", "hadoop", "kafka",

    // Concepts & Methodologies
    "rest", "graphql", "api", "microservices", "agile", "scrum", "devops", "ci/cd",
    "tdd", "bdd", "oop", "functional programming", "design patterns",

    // ERP & Business Software (important for this job!)
    "erp", "warenwirtschaft", "wawi", "sap", "oracle ebs", "dynamics", "navision",
    "individuallösung", "individualsoftware", "custom software",

    // Other common tech terms
    "linux", "windows", "macos", "ios", "android", "flutter", "react native",
    "wordpress", "shopify", "magento", "prestashop", "umbraco",
    "figma", "sketch", "adobe", "photoshop", "illustrator",
    "blockchain", "ethereum", "solidity", "web3",

    // Domain-specific terms
    "schnittstelle", "interface", "integration", "dokumentation", "testing",
    "programmierung", "entwicklung", "softwareentwicklung", "anwendungsentwicklung"
  ];

  const jobLower = jobText.toLowerCase();
  const found = [];
  const seen = new Set();

  // Extract only known technical terms
  for (const keyword of techKeywords) {
    const keywordLower = keyword.toLowerCase();

    // Check if keyword appears in job text (as whole word)
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(jobText) && !seen.has(keywordLower)) {
      seen.add(keywordLower);

      // Normalize label to standard format (e.g., "Javascript" -> "JavaScript", "Css" -> "CSS")
      let label = keyword;

      // Map common variations to standard labels
      const labelMap = {
        "js": "JavaScript",
        "javascript": "JavaScript",
        "ts": "TypeScript",
        "typescript": "TypeScript",
        "html": "HTML",
        "html5": "HTML5",
        "css": "CSS",
        "css3": "CSS3",
        "wawi": "Warenwirtschaftssystem",
        "mern": "MERN Stack",
        "mern-stack": "MERN Stack",
        "mernstack": "MERN Stack",
        "wordpress": "WordPress",
        "word press": "WordPress",
        "wp": "WordPress",
        "nodejs": "Node.js",
        "node js": "Node.js",
        "node.js": "Node.js",
        "mongodb": "MongoDB",
        "mongo db": "MongoDB",
        "fullstack": "Full Stack",
        "full-stack": "Full Stack",
        "full stack": "Full Stack",
        "frontend": "Frontend",
        "front-end": "Frontend",
        "backend": "Backend",
        "back-end": "Backend",
      };

      if (labelMap[keywordLower]) {
        label = labelMap[keywordLower];
      } else if (keyword === "js") {
        label = "JavaScript";
      } else if (keyword === "ts") {
        label = "TypeScript";
      } else if (keyword === "wawi") {
        label = "Warenwirtschaftssystem";
      } else if (keyword.includes(".")) {
        // Handle dotted keywords like "node.js" -> "Node.js"
        label = keyword.split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(".");
      } else {
        // For acronyms like CSS, HTML, JS - keep uppercase
        if (keywordLower.length <= 4 && keywordLower === keywordLower.toUpperCase()) {
          label = keyword.toUpperCase();
        } else {
          // Capitalize first letter for others
          label = keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
        }
      }

      found.push({ low: keywordLower, label });
    }
  }

  return found;
}

// Compare a job ad with the current profile (hybrid: curated + generic)
function analyzeJobMatch(jobText, profile, language, cvText) {
  const isGerman = language === "de";
  const jobLower = jobText.toLowerCase();

  // CV "blob" to search in: skills + titles
  // Also expand MERN/MERN-Stack to its components for better matching
  let cvSource =
    (cvText || "") +
    " " +
    (profile.skills || []).join(" ") +
    " " +
    (profile.titles || []).join(" ");

  // Expand MERN stack mentions to individual components for better matching
  const cvSourceLower = cvSource.toLowerCase();
  if (cvSourceLower.includes("mern") || cvSourceLower.includes("mern-stack")) {
    cvSource += " MongoDB Express React Node.js node.js nodejs";
  }

  // Expand other common stack names
  if (cvSourceLower.includes("mean")) {
    cvSource += " MongoDB Express Angular Node.js";
  }
  if (cvSourceLower.includes("mevn")) {
    cvSource += " MongoDB Express Vue Node.js";
  }

  const cvBlob = cvSource.toLowerCase();

  // 1) Curated keywords for nicer labels + synonyms - EXPANDED
  const keywordDefs = [
    // Frontend Languages
    { patterns: ["javascript", "js"], label: "JavaScript" },
    { patterns: ["typescript", "ts"], label: "TypeScript" },
    { patterns: ["html5", "html"], label: "HTML / HTML5" },
    { patterns: ["css3", "css"], label: "CSS / CSS3" },

    // Frontend Frameworks
    { patterns: ["react"], label: "React" },
    { patterns: ["vue", "vue.js"], label: "Vue.js" },
    { patterns: ["angular"], label: "Angular" },
    { patterns: ["svelte"], label: "Svelte" },
    { patterns: ["next.js", "nextjs"], label: "Next.js" },
    { patterns: ["nuxt", "nuxt.js"], label: "Nuxt.js" },
    { patterns: ["gatsby"], label: "Gatsby" },

    // CSS Frameworks
    { patterns: ["bootstrap"], label: "Bootstrap" },
    { patterns: ["tailwind", "tailwindcss"], label: "Tailwind CSS" },
    { patterns: ["sass", "scss"], label: "Sass/SCSS" },
    { patterns: ["less"], label: "Less" },

    // Backend Languages
    { patterns: ["python"], label: "Python" },
    { patterns: ["java"], label: "Java" },
    { patterns: ["golang", "go language"], label: "Go" },
    { patterns: ["rust"], label: "Rust" },
    { patterns: ["c#", "csharp"], label: "C#" },
    { patterns: ["php"], label: "PHP" },
    { patterns: ["ruby", "ruby on rails", "rails"], label: "Ruby/Rails" },
    { patterns: ["scala"], label: "Scala" },
    { patterns: ["kotlin"], label: "Kotlin" },
    { patterns: ["swift"], label: "Swift" },
    { patterns: ["dart"], label: "Dart" },

    // Backend Frameworks & Tools
    { patterns: ["node.js", "nodejs", "node js"], label: "Node.js" },
    { patterns: ["express"], label: "Express" },
    { patterns: ["nest", "nestjs"], label: "NestJS" },
    { patterns: ["django"], label: "Django" },
    { patterns: ["flask"], label: "Flask" },
    { patterns: ["fastapi"], label: "FastAPI" },
    { patterns: ["spring", "spring boot"], label: "Spring Boot" },
    { patterns: [".net", "dotnet", "asp.net"], label: ".NET" },
    { patterns: ["laravel"], label: "Laravel" },
    { patterns: ["symfony"], label: "Symfony" },

    // Databases
    { patterns: ["mongodb", "mongo db"], label: "MongoDB" },
    { patterns: ["mysql"], label: "MySQL" },
    { patterns: ["postgres", "postgresql"], label: "PostgreSQL" },
    { patterns: ["redis"], label: "Redis" },
    { patterns: ["elasticsearch", "elastic"], label: "Elasticsearch" },
    { patterns: ["cassandra"], label: "Cassandra" },
    { patterns: ["oracle"], label: "Oracle DB" },
    { patterns: ["sql server"], label: "SQL Server" },
    { patterns: ["sqlite"], label: "SQLite" },

    // Cloud Platforms
    { patterns: ["aws", "amazon web services"], label: "AWS" },
    { patterns: ["azure"], label: "Azure" },
    { patterns: ["gcp", "google cloud", "google cloud platform"], label: "GCP" },

    // DevOps Tools
    { patterns: ["docker"], label: "Docker" },
    { patterns: ["kubernetes", "k8s"], label: "Kubernetes" },
    { patterns: ["terraform"], label: "Terraform" },
    { patterns: ["ansible"], label: "Ansible" },
    { patterns: ["jenkins"], label: "Jenkins" },
    { patterns: ["gitlab ci", "github actions"], label: "CI/CD" },
    { patterns: ["circleci"], label: "CircleCI" },
    { patterns: ["travis"], label: "Travis CI" },

    // Data Science & ML
    { patterns: ["python"], label: "Python" },
    { patterns: ["tensorflow"], label: "TensorFlow" },
    { patterns: ["pytorch"], label: "PyTorch" },
    { patterns: ["pandas"], label: "Pandas" },
    { patterns: ["numpy"], label: "NumPy" },
    { patterns: ["scikit", "sklearn"], label: "Scikit-learn" },
    { patterns: ["jupyter"], label: "Jupyter" },
    { patterns: ["spark", "apache spark"], label: "Apache Spark" },
    { patterns: ["hadoop"], label: "Hadoop" },
    { patterns: ["kafka"], label: "Apache Kafka" },

    // Design & UX
    { patterns: ["ux/ui", "ui/ux"], label: "UX/UI" },
    { patterns: ["ux", "user experience"], label: "UX" },
    { patterns: ["ui", "user interface"], label: "UI" },
    { patterns: ["figma"], label: "Figma" },
    { patterns: ["sketch"], label: "Sketch" },
    { patterns: ["adobe xd"], label: "Adobe XD" },

    // CMS & E-learning
    { patterns: ["wordpress", "wp"], label: "WordPress" },
    { patterns: ["moodle"], label: "Moodle" },
    { patterns: ["ilias"], label: "ILIAS" },
    { patterns: ["scorm"], label: "SCORM" },
    { patterns: ["xapi", "tin can api"], label: "xAPI" },
    { patterns: ["h5p"], label: "H5P" },

    // Mobile
    { patterns: ["react native", "react-native"], label: "React Native" },
    { patterns: ["flutter"], label: "Flutter" },
    { patterns: ["android"], label: "Android" },
    { patterns: ["ios"], label: "iOS" },

    // Testing
    { patterns: ["jest"], label: "Jest" },
    { patterns: ["cypress"], label: "Cypress" },
    { patterns: ["selenium"], label: "Selenium" },
    { patterns: ["playwright"], label: "Playwright" },
    { patterns: ["pytest"], label: "pytest" },
    { patterns: ["junit"], label: "JUnit" },

    // General
    { patterns: ["frontend", "front-end"], label: "Frontend" },
    { patterns: ["backend", "back-end"], label: "Backend" },
    { patterns: ["fullstack", "full-stack", "full stack"], label: "Fullstack" },
    { patterns: ["api", "rest api", "graphql"], label: "API Development" },
    { patterns: ["microservices"], label: "Microservices" },
    { patterns: ["git"], label: "Git" },
  ];

  const jobSkillLabels = [];
  const jobLabelSet = new Set();
  const overlap = [];
  const overlapSet = new Set();
  const missing = [];
  const missingSet = new Set();

  // Normalize label to a canonical key (for deduplication)
  function getNormalizedKey(label) {
    return label.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\/\-]/g, ' ')
      .trim();
  }

  // helper for adding one label (with normalization to avoid duplicates)
  function addJobLabel(label, presentInCv) {
    // Normalize label to avoid duplicates like "CSS / CSS3" and "Css"
    const normalizedKey = getNormalizedKey(label);

    // Check if we already have this (normalized) label
    if (!jobLabelSet.has(normalizedKey)) {
      jobLabelSet.add(normalizedKey);
      jobSkillLabels.push(label);
    } else {
      // Already added - don't duplicate, but update match status if needed
      const existingIndex = jobSkillLabels.findIndex(l => getNormalizedKey(l) === normalizedKey);
      if (existingIndex !== -1 && presentInCv) {
        // If it's a match, make sure it's in overlap
        const existingLabel = jobSkillLabels[existingIndex];
        if (!overlapSet.has(normalizedKey)) {
          overlapSet.add(normalizedKey);
          overlap.push(existingLabel);
          // Remove from missing if it was there
          const missingIndex = missing.findIndex(m => getNormalizedKey(m) === normalizedKey);
          if (missingIndex !== -1) {
            missing.splice(missingIndex, 1);
            missingSet.delete(normalizedKey);
          }
        }
      }
      return; // Skip adding duplicate
    }

    if (presentInCv) {
      if (!overlapSet.has(normalizedKey)) {
        overlapSet.add(normalizedKey);
        overlap.push(label);
      }
    } else {
      if (!missingSet.has(normalizedKey)) {
        missingSet.add(normalizedKey);
        missing.push(label);
      }
    }
  }

  // --- 1) curated keywords ---
  keywordDefs.forEach((def) => {
    // Check all variations case-insensitively
    const foundInJob = def.patterns.some((p) => {
      const regex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(jobText);
    });
    if (!foundInJob) return;

    // More flexible matching: check all patterns and handle variations (case-insensitive)
    const presentInCv = def.patterns.some((p) => {
      const pLower = p.toLowerCase();
      // Direct match (case-insensitive)
      if (cvBlob.includes(pLower)) return true;

      // Also check if any variation of the pattern exists in CV (normalized)
      // e.g., "javascript", "Javascript", "JavaScript" should all match
      const patternRegex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (patternRegex.test(cvSource)) return true;

      // Handle variations (e.g., "mern-stack" contains "node.js" components)
      // Check for MERN stack which includes React, Node.js, MongoDB, Express
      if (p === "react" && (cvBlob.includes("mern") || cvBlob.includes("mern-stack"))) return true;
      if ((p === "node.js" || p === "nodejs" || p === "node js") &&
        (cvBlob.includes("mern") || cvBlob.includes("mern-stack") || cvBlob.includes("node"))) return true;
      if ((p === "mongodb" || p === "mongo db") &&
        (cvBlob.includes("mern") || cvBlob.includes("mern-stack") || cvBlob.includes("mongo"))) return true;
      if (p === "express" && cvBlob.includes("mern")) return true;

      // Handle HTML5/HTML variations
      if (p === "html5" && cvBlob.includes("html")) return true;
      if (p === "html" && (cvBlob.includes("html5") || cvBlob.includes("html"))) return true;

      // Handle CSS3/CSS variations
      if (p === "css3" && cvBlob.includes("css")) return true;
      if (p === "css" && (cvBlob.includes("css3") || cvBlob.includes("css"))) return true;

      // Handle JavaScript/JS variations
      if ((p === "javascript" || p === "js") &&
        (cvBlob.includes("javascript") || cvBlob.includes(" js ") || cvBlob.includes("js,") || cvBlob.includes("js."))) return true;

      // Handle Node.js variations (node.js, nodejs, node js)
      if ((p === "node.js" || p === "nodejs" || p === "node js") &&
        (cvBlob.includes("node.js") || cvBlob.includes("nodejs") || cvBlob.includes("node js") ||
          cvBlob.includes("mern") || cvBlob.includes("mern-stack"))) return true;

      // Handle Bootstrap
      if (p === "bootstrap" && cvBlob.includes("bootstrap")) return true;

      // Handle React variations
      if (p === "react" && (cvBlob.includes("react") || cvBlob.includes("mern"))) return true;

      return false;
    });

    addJobLabel(def.label, presentInCv);
  });

  // --- 2) Only extract known technical tokens (not random words) ---
  const jobTokens = extractJobTokens(jobText);
  jobTokens.forEach(({ low, label }) => {
    // More flexible matching for extracted tokens (case-insensitive)
    let presentInCv = cvBlob.includes(low);

    // Also check original CV text for case variations (e.g., "Javascript" vs "JavaScript")
    if (!presentInCv) {
      const labelVariations = [
        label.toLowerCase(),
        label.toUpperCase(),
        label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), // "Javascript"
        label, // Original case
      ];

      for (const variant of labelVariations) {
        const variantRegex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (variantRegex.test(cvSource)) {
          presentInCv = true;
          break;
        }
      }
    }

    // Handle special cases and variations
    if (!presentInCv) {
      // MERN stack contains multiple technologies
      if ((low === "react" || low === "node.js" || low === "mongodb" || low === "express") && cvBlob.includes("mern")) {
        presentInCv = true;
      }
      // HTML/HTML5 - normalize variations
      if ((low === "html" || low === "html5") && (cvBlob.includes("html"))) {
        presentInCv = true;
      }
      // CSS/CSS3 - normalize variations (css, Css, CSS all match)
      if ((low === "css" || low === "css3") && (cvBlob.includes("css"))) {
        presentInCv = true;
      }
      // JavaScript/JS - normalize variations (javascript, Javascript, JavaScript all match)
      if ((low === "javascript" || low === "js") && (cvBlob.includes("javascript") || cvBlob.includes(" js ") || /javascript/i.test(cvSource))) {
        presentInCv = true;
      }
      // Node.js variations
      if ((low === "node.js" || low === "nodejs") && (cvBlob.includes("node") || cvBlob.includes("mern"))) {
        presentInCv = true;
      }
    }

    addJobLabel(label, presentInCv);
  });

  // --- 3) Detect role concepts even without specific tech keywords ---
  const roleConcepts = [];

  // Programming/Development concepts
  if (/\bprogrammierer|programmierung|softwareentwicklung|anwendungsentwicklung|software entwickler|entwickler|developer|programming|software development\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Programmierung / Softwareentwicklung" : "Programming / Software Development",
      weight: 3
    });
  }

  // Database concepts
  if (/\b(relationale\s+)?datenbank(en)?|database|sql|datenbank(en)?|db\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Datenbanken" : "Databases",
      weight: 2
    });
  }

  // ERP / Business Software
  if (/\bwarenwirtschaft(ssystem)?|wawi|erp|business software|business system|wirtschaftssystem\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "ERP / Warenwirtschaftssysteme" : "ERP / Business Systems",
      weight: 3
    });
  }

  // Custom/Individual Software
  if (/\bindividualsoftware|individualsoftware|individuell(e\s+)?(lösung|software|anwendung)|custom software|custom solution\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Individualsoftware" : "Custom Software",
      weight: 2
    });
  }

  // Interfaces/Integration
  if (/\bschnittstelle(n)?|interface(s)?|integration|api|schnittstellenentwicklung\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Schnittstellen / Integration" : "Interfaces / Integration",
      weight: 2
    });
  }

  // Testing
  if (/\btest(s)?|testing|qualitätssicherung|quality assurance|qa\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Testing / Qualitätssicherung" : "Testing / Quality Assurance",
      weight: 1
    });
  }

  // Documentation
  if (/\bdokumentation|documentation|dokumentieren\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Dokumentation" : "Documentation",
      weight: 1
    });
  }

  // Project work
  if (/\bprojekt(arbeit)?|project|eigenverantwortlich|autonomous|self.*responsible\b/i.test(jobLower)) {
    roleConcepts.push({
      label: isGerman ? "Projektarbeit" : "Project Work",
      weight: 1
    });
  }

  // Add role concepts to analysis if we have programming experience
  const hasProgrammingExperience = /\bprogrammierer|developer|programming|software|code|entwickler|entwicklung\b/i.test(cvBlob);

  roleConcepts.forEach(({ label, weight }) => {
    if (hasProgrammingExperience) {
      // If user has programming experience, these concepts are likely matches
      if (!overlapSet.has(label)) {
        overlapSet.add(label);
        overlap.push(label);
        if (!jobLabelSet.has(label)) {
          jobLabelSet.add(label);
          jobSkillLabels.push(label);
        }
      }
    } else {
      // Otherwise mark as potentially missing
      if (!missingSet.has(label)) {
        missingSet.add(label);
        missing.push(label);
        if (!jobLabelSet.has(label)) {
          jobLabelSet.add(label);
          jobSkillLabels.push(label);
        }
      }
    }
  });

  const total = jobSkillLabels.length || 1;
  const matchPercent =
    jobSkillLabels.length > 0 ? Math.round((overlap.length / total) * 100) : 0;

  // Rough "direction" of the role - EXPANDED
  const dirs = new Set();

  // ERP / Business Software
  if (/\bwarenwirtschaft(ssystem)?|wawi|erp|business software|business system|wirtschaftssystem|individualsoftware|custom software\b/i.test(jobLower)) {
    dirs.add("erp-heavy");
  }

  // Frontend
  if (/\bfrontend|react|javascript|typescript|vue|angular|svelte|html|css\b/i.test(jobLower)) {
    dirs.add("frontend-heavy");
  }

  // Backend
  if (/\bbackend|node\.js|nodejs|api|server|python|java|go|rust|c#|\.net|php|ruby|scala|kotlin|programmierer|programmierung|softwareentwicklung\b/i.test(jobLower)) {
    dirs.add("backend-heavy");
  }

  // Fullstack
  if (
    jobLower.includes("fullstack") ||
    jobLower.includes("full-stack") ||
    (dirs.has("frontend-heavy") && dirs.has("backend-heavy"))
  ) {
    dirs.add("fullstack");
  }

  // DevOps / Cloud
  if (/\bdevops|sre|docker|kubernetes|k8s|terraform|aws|azure|gcp|jenkins|ci\/cd|infrastructure\b/i.test(jobLower)) {
    dirs.add("devops-heavy");
  }

  // Data Science / ML
  if (/\bdata science|data scientist|machine learning|ml engineer|tensorflow|pytorch|pandas|numpy|data engineer|big data|spark|hadoop\b/i.test(jobLower)) {
    dirs.add("data-heavy");
  }

  // Design
  if (/\bdesign|ux|ui|figma|adobe|sketch|product designer|visual designer\b/i.test(jobLower)) {
    dirs.add("design-heavy");
  }

  // AI / Prompt Engineering
  if (/\bai\b|künstliche intelligenz|prompt engineer|llm|chatgpt|gpt|generative ai\b/i.test(jobLower)) {
    dirs.add("ai-heavy");
  }

  // Security
  if (/\bsecurity|cybersecurity|penetration|pentest|infosec\b/i.test(jobLower)) {
    dirs.add("security-heavy");
  }

  // Mobile
  if (/\bmobile|android|ios|react native|flutter|swift|kotlin\b/i.test(jobLower)) {
    dirs.add("mobile-heavy");
  }

  // QA / Testing
  if (/\bqa|quality assurance|test automation|testing|selenium|cypress|jest\b/i.test(jobLower)) {
    dirs.add("qa-heavy");
  }

  // Game Development
  if (/\bgame|unity|unreal|gamedev\b/i.test(jobLower)) {
    dirs.add("gamedev-heavy");
  }

  // Blockchain
  if (/\bblockchain|ethereum|solidity|web3\b/i.test(jobLower)) {
    dirs.add("blockchain-heavy");
  }

  // Embedded / IoT
  if (/\bembedded|iot|internet of things|arduino|c\+\+|cpp\b/i.test(jobLower)) {
    dirs.add("embedded-heavy");
  }

  // If no specific direction detected but has programming keywords, assume backend
  if (dirs.size === 0 && /\bprogrammierer|programmierung|softwareentwicklung|entwickler|developer|programming\b/i.test(jobLower)) {
    dirs.add("backend-heavy");
  }

  const dirArray = Array.from(dirs);

  // Map internal direction codes to readable labels
  const dirLabels = {
    "erp-heavy": isGerman ? "ERP / Business Software" : "ERP / Business Software",
    "frontend-heavy": isGerman ? "Frontend" : "Frontend",
    "backend-heavy": isGerman ? "Backend / Softwareentwicklung" : "Backend / Software Development",
    "fullstack": isGerman ? "Fullstack" : "Fullstack",
    "devops-heavy": isGerman ? "DevOps / Cloud" : "DevOps / Cloud",
    "data-heavy": isGerman ? "Data Science / ML" : "Data Science / ML",
    "design-heavy": isGerman ? "Design" : "Design",
    "ai-heavy": isGerman ? "AI" : "AI",
    "security-heavy": isGerman ? "Security" : "Security",
    "mobile-heavy": isGerman ? "Mobile" : "Mobile",
    "qa-heavy": isGerman ? "QA / Testing" : "QA / Testing",
    "gamedev-heavy": isGerman ? "Game Development" : "Game Development",
    "blockchain-heavy": isGerman ? "Blockchain" : "Blockchain",
    "embedded-heavy": isGerman ? "Embedded / IoT" : "Embedded / IoT"
  };

  const dirLabel =
    dirArray.length === 0
      ? isGerman
        ? "Softwareentwicklung (allgemein)"
        : "Software Development (general)"
      : dirArray.map(dir => dirLabels[dir] || dir).join(", ");

  let message = "";
  let recommendation = "";
  let matchLevel = "";

  // Determine match level
  if (matchPercent >= 80) {
    matchLevel = isGerman ? "Sehr gute Übereinstimmung" : "Excellent Match";
    recommendation = isGerman
      ? "✅ Diese Position passt sehr gut zu deinem Profil! Du solltest dich unbedingt bewerben. Hebe die gemeinsamen Skills in deinem Anschreiben hervor und zeige Beispiele aus deiner Erfahrung."
      : "✅ This position is an excellent match for your profile! You should definitely apply. Highlight the shared skills in your cover letter and showcase examples from your experience.";
  } else if (matchPercent >= 60) {
    matchLevel = isGerman ? "Gute Übereinstimmung" : "Good Match";
    recommendation = isGerman
      ? "✅ Gute Übereinstimmung! Du hast die meisten relevanten Skills. Betone in deiner Bewerbung deine Stärken und erwähne, dass du offen für neue Technologien bist, falls welche fehlen."
      : "✅ Good match! You have most of the relevant skills. Emphasize your strengths in your application and mention that you're open to learning new technologies if any are missing.";
  } else if (matchPercent >= 40) {
    matchLevel = isGerman ? "Teilweise Übereinstimmung" : "Partial Match";
    recommendation = isGerman
      ? "⚠️ Teilweise Übereinstimmung. Du hast einige relevante Skills, aber es fehlen wichtige Technologien. Überlege, ob du die fehlenden Skills schnell lernen könntest oder ob du sie durch verwandte Erfahrungen kompensieren kannst. Wenn ja, bewerbe dich und erkläre deine Lernbereitschaft."
      : "⚠️ Partial match. You have some relevant skills, but important technologies are missing. Consider whether you could quickly learn the missing skills or compensate with related experience. If so, apply and explain your willingness to learn.";
  } else if (matchPercent >= 20) {
    matchLevel = isGerman ? "Wenige Übereinstimmungen" : "Limited Match";
    recommendation = isGerman
      ? "❌ Nur wenige Übereinstimmungen. Diese Position könnte eine größere Herausforderung sein. Überlege dir, ob du wirklich Zeit investieren möchtest, um die fehlenden Skills zu lernen. Alternativ könntest du nach ähnlichen Rollen suchen, die besser zu deinem aktuellen Profil passen."
      : "❌ Limited match. This position could be a bigger challenge. Consider whether you're willing to invest time to learn the missing skills. Alternatively, you could look for similar roles that better match your current profile.";
  } else {
    matchLevel = isGerman ? "Schlechte Übereinstimmung" : "Poor Match";
    recommendation = isGerman
      ? "❌ Diese Position passt nicht gut zu deinem aktuellen Profil. Es fehlen zu viele grundlegende Skills. Suche besser nach Rollen, die besser zu deinen vorhandenen Fähigkeiten passen."
      : "❌ This position doesn't match your current profile well. Too many fundamental skills are missing. It's better to look for roles that better match your existing skills.";
  }

  if (!jobSkillLabels.length) {
    // Even if no specific tech keywords, check if it's a programming role
    const isProgrammingRole = /\bprogrammierer|programmierung|softwareentwicklung|entwickler|developer|programming|software development|anwendungsentwicklung\b/i.test(jobLower);

    if (isProgrammingRole) {
      const hasProgrammingInCv = /\bprogrammierer|developer|programming|software|code|entwickler|entwicklung|programmierung\b/i.test(cvBlob);

      if (hasProgrammingInCv) {
        message = isGerman
          ? `📊 **Analyse: Generische Softwareentwickler-Position**\n\n` +
          `Diese Anzeige beschreibt eine allgemeine Softwareentwickler-Position ohne spezifische Technologie-Anforderungen. Basierend auf deinem Profil:\n\n` +
          `✅ **Du hast Programmiererfahrung** – das ist ein gutes Zeichen!\n\n` +
          `**Empfehlung:**\n` +
          `Diese Position scheint flexibel bezüglich der Programmiersprache zu sein. ` +
          `Wenn du generelle Programmierkenntnisse und die Bereitschaft hast, neue Sprachen zu lernen, ` +
          `kannst du dich bewerben. Hebe in deinem Anschreiben hervor:\n` +
          `• Deine Programmiererfahrung\n` +
          `• Deine Fähigkeit, neue Technologien schnell zu erlernen\n` +
          `• Erfahrung mit Softwareentwicklung im Allgemeinen\n` +
          `• Erfahrung mit Datenbanken (falls vorhanden)`
          : `📊 **Analysis: Generic Software Developer Position**\n\n` +
          `This ad describes a general software developer position without specific technology requirements. Based on your profile:\n\n` +
          `✅ **You have programming experience** – that's a good sign!\n\n` +
          `**Recommendation:**\n` +
          `This position seems flexible regarding programming language. ` +
          `If you have general programming skills and willingness to learn new languages, ` +
          `you can apply. Highlight in your cover letter:\n` +
          `• Your programming experience\n` +
          `• Your ability to quickly learn new technologies\n` +
          `• General software development experience\n` +
          `• Database experience (if applicable)`;
      } else {
        message = isGerman
          ? `📊 **Analyse: Softwareentwickler-Position**\n\n` +
          `Diese Anzeige beschreibt eine Softwareentwickler-Position, aber ich sehe keine klaren Programmierkenntnisse in deinem CV.\n\n` +
          `**Empfehlung:**\n` +
          `Wenn du Programmierkenntnisse hast, die nicht klar im CV sichtbar sind, ` +
          `solltest du sie hinzufügen. Ansonsten könnte diese Position schwierig sein.`
          : `📊 **Analysis: Software Developer Position**\n\n` +
          `This ad describes a software developer position, but I don't see clear programming skills in your CV.\n\n` +
          `**Recommendation:**\n` +
          `If you have programming skills that aren't clearly visible in your CV, ` +
          `you should add them. Otherwise, this position might be challenging.`;
      }
    } else {
      message =
        (isGerman
          ? "Ich sehe in dieser Anzeige keine klaren technischen Stichwörter, die ich automatisch vergleichen kann.\n\n"
          : "I can't see any clear technical keywords in this ad that I can automatically compare.\n\n") +
        (isGerman
          ? "Du kannst mir gern eine andere Anzeige schicken oder mir konkret schreiben, welche Technologien darin wichtig sind."
          : "You can paste another ad or tell me explicitly which technologies are important in it.");
    }
  } else {
    message += isGerman
      ? `📊 **Analyse: ${matchLevel} (${matchPercent}%)**\n\n`
      : `📊 **Analysis: ${matchLevel} (${matchPercent}%)**\n\n`;

    message += isGerman
      ? `**Übereinstimmung:** ${matchPercent}% der geforderten Tech-Skills sind in deinem Profil vorhanden.\n\n`
      : `**Match:** ${matchPercent}% of the required tech skills are present in your profile.\n\n`;

    if (overlap.length) {
      message +=
        (isGerman ? "✅ **Deine Stärken (in dieser Position relevant):**\n" : "✅ **Your Strengths (relevant for this position):**\n") +
        overlap.slice(0, 20).map((s) => `   • ${s}`).join("\n") +
        "\n\n";
    }

    if (missing.length) {
      message +=
        (isGerman
          ? "⚠️ **Fehlende Skills (in der Anzeige wichtig):**\n"
          : "⚠️ **Missing Skills (important in the ad):**\n") +
        missing.slice(0, 20).map((s) => `   • ${s}`).join("\n") +
        "\n\n";
    }

    // Add helpful note if CV was analyzed
    if (cvText && overlap.length > 0) {
      message += (isGerman
        ? "💡 **Tipp:** Falls du Skills hast, die hier nicht erscheinen, stelle sicher, dass sie klar in deinem CV erwähnt sind (z.B. im Skills-Bereich).\n\n"
        : "💡 **Tip:** If you have skills that don't appear here, make sure they're clearly mentioned in your CV (e.g., in the skills section).\n\n");
    }

    message +=
      (isGerman ? "🎯 **Rolle fokussiert auf:** " : "🎯 **Role focuses on:** ") +
      dirLabel +
      "\n\n" +
      "---\n\n" +
      `**💡 Meine Empfehlung:**\n${recommendation}`;

    // Add actionable tips
    if (matchPercent >= 40 && missing.length > 0) {
      message +=
        "\n\n" +
        (isGerman
          ? "**Tipps für deine Bewerbung:**\n"
          : "**Tips for your application:**\n") +
        (isGerman
          ? "• Hebe die Skills hervor, die du bereits hast\n• Zeige konkrete Beispiele aus deiner Erfahrung\n• Erwähne deine Lernbereitschaft für die fehlenden Technologien\n• Falls du verwandte Skills hast, erkläre, wie sie übertragbar sind"
          : "• Highlight the skills you already have\n• Show concrete examples from your experience\n• Mention your willingness to learn the missing technologies\n• If you have related skills, explain how they're transferable");
    }
  }

  return { message, matchPercent, overlap, missing, directions: dirArray, matchLevel, recommendation };
}

// --- Chatbot ---
function Chatbot({ profile, onProfileUpdate, cvText, language, t }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        language === "de"
          ? "Hallo! 👋 Ich bin dein Job Search Companion.\n\nIch kann dir helfen:\n• **Stellenanzeigen analysieren** – füge einfach eine Anzeige ein und ich prüfe, ob du dafür geeignet bist\n• **Alternative Rollen finden** – frage z.B. 'Was für alternative Rollen passen zu meinen Skills?'\n• **Dein Profil verfeinern** – z.B. 'Ich will weniger Coding, mehr Design'\n• **Bewerbungstipps** – ich gebe dir konkrete Empfehlungen basierend auf deinem CV\n\nProbiere es aus – füge eine Stellenanzeige ein oder stelle mir eine Frage!"
          : "Hello! 👋 I'm your Job Search Companion.\n\nI can help you with:\n• **Analyzing job ads** – just paste an ad and I'll check if you're a good match\n• **Finding alternative roles** – ask e.g. 'What alternative roles fit my skills?'\n• **Refining your profile** – e.g. 'I want less coding, more design'\n• **Application tips** – I'll give you concrete recommendations based on your CV\n\nTry it out – paste a job ad or ask me a question!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateResponse = (userMessage) => {
    const lower = userMessage.toLowerCase();
    const isGerman = language === "de";
    const response = {
      updatedProfile: null,
      message: "",
    };

    // NEW: detect if the message looks like a full job ad
    const looksLikeJobAd =
      userMessage.length > 300 ||
      /\b(m\/w\/d|w\/m\/d|aufgaben|deine aufgaben|wir bieten|wir bieten dir|dein profil|anforderungen|qualifikationen|requirements|responsibilities|what you will do|what you'll do|your profile|stellenbeschreibung|job description|we are looking for|wir suchen)\b/i.test(
        userMessage
      );

    if (
      looksLikeJobAd &&
      (profile?.skills?.length || profile?.titles?.length || cvText)
    ) {
      const match = analyzeJobMatch(userMessage, profile, language, cvText);
      response.message = match.message;
      return response;
    }

    // Check for alternative roles FIRST (before job match queries)
    // This prevents "passen" in "alternative Rollen passen" from triggering job match query
    if (
      lower.includes("alternative") ||
      lower.includes("andere") ||
      lower.includes("was sonst") ||
      lower.includes("was könnte") ||
      (lower.includes("passen") && (lower.includes("alternative") || lower.includes("andere") || lower.includes("rollen") || lower.includes("skills")))
    ) {
      if (!cvText && (!profile.skills || profile.skills.length === 0)) {
        response.message = isGerman
          ? "Um dir passende alternative Rollen vorzuschlagen, brauche ich dein CV oder deine Skills. Bitte füge zuerst dein CV ein oder analysiere es."
          : "To suggest suitable alternative roles, I need your CV or your skills. Please add your CV first or analyze it.";
        return response;
      }

      const cvBlob = ((cvText || "") + " " + (profile.skills || []).join(" ")).toLowerCase();
      const newTitles = new Set(profile.titles || []);
      const suggestions = [];

      // Frontend / Web Development
      if (cvBlob.match(/\b(react|javascript|typescript|js|ts|frontend|vue|angular|html|css)\b/i)) {
        newTitles.add("UX Engineer");
        newTitles.add("Technical Writer");
        newTitles.add("Product Designer");
        newTitles.add("Frontend Architect");
        newTitles.add("UI Developer");
        suggestions.push(isGerman ? "• UX/UI Rollen (wegen deiner Frontend-Skills)" : "• UX/UI roles (because of your frontend skills)");
      }

      // WordPress / Design
      if (cvBlob.match(/\b(wordpress|design|figma|adobe|photoshop|illustrator)\b/i)) {
        newTitles.add("Content Manager");
        newTitles.add("Web Content Specialist");
        newTitles.add("No-Code Web Builder");
        newTitles.add("CMS Specialist");
        suggestions.push(isGerman ? "• Content & CMS Rollen (wegen Design/WordPress)" : "• Content & CMS roles (because of design/WordPress)");
      }

      // AI / ML
      if (cvBlob.match(/\b(ai|artificial intelligence|machine learning|ml|prompt|chatgpt|gpt)\b/i)) {
        newTitles.add("AI Content Strategist");
        newTitles.add("Prompt Engineer");
        newTitles.add("AI Product Manager");
        suggestions.push(isGerman ? "• AI-Rollen (wegen deiner KI-Erfahrung)" : "• AI roles (because of your AI experience)");
      }

      // Backend / Full Stack
      if (cvBlob.match(/\b(backend|node|python|java|api|server|fullstack|full stack)\b/i)) {
        newTitles.add("API Developer");
        newTitles.add("Backend Architect");
        newTitles.add("Integration Specialist");
        newTitles.add("Solutions Architect");
        suggestions.push(isGerman ? "• Architektur-Rollen (wegen Backend-Skills)" : "• Architecture roles (because of backend skills)");
      }

      // Data
      if (cvBlob.match(/\b(data|analytics|sql|database|datenbank)\b/i)) {
        newTitles.add("Data Analyst");
        newTitles.add("Business Intelligence Developer");
        newTitles.add("Data Engineer");
        suggestions.push(isGerman ? "• Data-Rollen (wegen Datenbank-Skills)" : "• Data roles (because of database skills)");
      }

      // DevOps / Cloud
      if (cvBlob.match(/\b(devops|docker|kubernetes|aws|azure|gcp|cloud|terraform)\b/i)) {
        newTitles.add("Cloud Architect");
        newTitles.add("Platform Engineer");
        newTitles.add("SRE (Site Reliability Engineer)");
        suggestions.push(isGerman ? "• Cloud/Infrastructure-Rollen" : "• Cloud/Infrastructure roles");
      }

      // Testing / QA
      if (cvBlob.match(/\b(testing|qa|quality|selenium|cypress|jest|automation)\b/i)) {
        newTitles.add("Test Automation Engineer");
        newTitles.add("Quality Assurance Lead");
        newTitles.add("QA Architect");
        suggestions.push(isGerman ? "• Testing-Rollen (wegen QA-Erfahrung)" : "• Testing roles (because of QA experience)");
      }

      // General Programming
      if (cvBlob.match(/\b(programmierer|programming|developer|entwickler|software)\b/i)) {
        newTitles.add("Technical Lead");
        newTitles.add("Software Architect");
        newTitles.add("Consultant");
        suggestions.push(isGerman ? "• Lead/Architektur-Rollen (wegen Programmiererfahrung)" : "• Lead/Architecture roles (because of programming experience)");
      }

      const titlesArray = Array.from(newTitles);
      response.updatedProfile = {
        ...profile,
        titles: titlesArray,
        titlesRaw: titlesArray.join("\n"),
      };

      let message = isGerman
        ? "📋 **Alternative Rollen basierend auf deinem CV/Profil:**\n\n"
        : "📋 **Alternative Roles Based on Your CV/Profile:**\n\n";

      if (suggestions.length > 0) {
        message += suggestions.join("\n") + "\n\n";
      }

      message += isGerman
        ? `Ich habe dir **${titlesArray.length} Jobtitel** vorgeschlagen, die zu deinen Skills passen könnten. Schau dir die aktualisierten Jobtitel im Profil-Bereich an!`
        : `I've suggested **${titlesArray.length} job titles** that might fit your skills. Check out the updated job titles in the profile section!`;

      response.message = message;
      return response;
    }

    // Handle job match queries (check AFTER alternative roles to avoid conflicts)
    if (
      (lower.includes("match") || lower.includes("geeignet") ||
        lower.includes("qualifiziert") || lower.includes("passe ich") || lower.includes("soll ich mich bewerben") ||
        lower.includes("should i apply") || lower.includes("do i match") || lower.includes("qualify") ||
        (lower.includes("pass") && !lower.includes("alternative") && !lower.includes("andere")))
      && cvText
    ) {
      response.message = isGerman
        ? "Um zu sehen, ob du für eine Position geeignet bist, füge bitte den Text der Stellenanzeige ein. Ich analysiere dann die Übereinstimmung zwischen deinem CV und den Anforderungen."
        : "To see if you match a position, please paste the job ad text. I'll then analyze the match between your CV and the requirements.";
      return response;
    }

    if (
      lower.includes("weniger") &&
      (lower.includes("coding") ||
        lower.includes("programmieren") ||
        lower.includes("code"))
    ) {
      const designTitles = [
        "UX/UI Designer",
        "Digital Designer",
        "Product Designer",
        "Webdesigner",
        "Visual Designer",
      ];
      const base = response.updatedProfile || profile;
      const newTitles = new Set([...base.titles, ...designTitles]);
      const titlesArray = Array.from(newTitles);
      response.updatedProfile = {
        ...base,
        titles: titlesArray,
        titlesRaw: titlesArray.join("\n"),
      };
      response.message =
        (response.message ? response.message + " " : "") +
        (isGerman
          ? "Ich habe dir Design-orientierte Rollen hinzugefügt. Diese könnten weniger Coding und mehr kreative Arbeit beinhalten."
          : "I've added design-oriented roles. These might involve less coding and more creative work.");
    }

    if (lower.includes("remote") || lower.includes("homeoffice")) {
      // no more workModes in profile – just give a hint
      response.message =
        (response.message ? response.message + " " : "") +
        (isGerman
          ? "Für Remote oder Homeoffice kannst du später direkt in den Filtern von Indeed, Stepstone oder LinkedIn auswählen. Hier konzentrieren wir uns nur auf gute Titel und Keywords."
          : "For remote or homeoffice you can use the filters directly on Indeed, Stepstone or LinkedIn. Here we focus on good titles and keywords.");
    }

    if (
      lower.includes("stress") ||
      lower.includes("ruhiger") ||
      lower.includes("kein kundenkontakt")
    ) {
      const calmTitles = [
        "Backend Developer",
        "Technical Writer",
        "QA Engineer",
        "DevOps Engineer",
      ];
      const base = response.updatedProfile || profile;
      const newTitles = new Set([...base.titles, ...calmTitles]);
      const titlesArray = Array.from(newTitles);
      response.updatedProfile = {
        ...base,
        titles: titlesArray,
        titlesRaw: titlesArray.join("\n"),
      };
      response.message =
        (response.message ? response.message + " " : "") +
        (isGerman
          ? "Ich habe dir Rollen vorgeschlagen, die typischerweise weniger Kundenkontakt und mehr Deep Work beinhalten."
          : "I've suggested roles that typically involve less customer contact and more deep work.");
    }

    if (lower.includes("kreativ") || lower.includes("creative")) {
      const creativeTitles = [
        "Creative Technologist",
        "Digital Designer",
        "UX Designer",
        "Content Creator",
      ];
      const base = response.updatedProfile || profile;
      const newTitles = new Set([...base.titles, ...creativeTitles]);
      const titlesArray = Array.from(newTitles);
      response.updatedProfile = {
        ...base,
        titles: titlesArray,
        titlesRaw: titlesArray.join("\n"),
      };
      response.message =
        (response.message ? response.message + " " : "") +
        (isGerman
          ? "Ich habe kreativere Rollen zu deinem Profil hinzugefügt!"
          : "I've added more creative roles to your profile!");
    }

    if (!response.message) {
      const suggestions = isGerman
        ? [
          "Füge eine Stellenanzeige ein, damit ich prüfen kann, ob du dafür geeignet bist",
          "Frage: 'Was für alternative Rollen passen zu meinen Skills?'",
          "Sage: 'Ich will weniger Coding, mehr Design'",
          "Frage nach Remote-Optionen oder anderen Präferenzen",
          "Lass dich zu deinem Profil beraten: 'Was kann ich verbessern?'"
        ]
        : [
          "Paste a job ad and I'll check if you're a good match",
          "Ask: 'What alternative roles fit my skills?'",
          "Say: 'I want less coding, more design'",
          "Ask about remote options or other preferences",
          "Get advice on your profile: 'What can I improve?'"
        ];

      response.message = (isGerman
        ? "Ich kann dir in verschiedenen Bereichen helfen:\n\n"
        : "I can help you in several areas:\n\n") +
        suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        (isGerman
          ? "\n\nEinfach loslegen – füge eine Anzeige ein oder stelle mir eine Frage!"
          : "\n\nJust get started – paste an ad or ask me a question!");
    }

    return response;
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    setTimeout(() => {
      const botResponse = generateResponse(userMessage);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botResponse.message },
      ]);

      if (botResponse.updatedProfile) {
        onProfileUpdate(botResponse.updatedProfile);
      }

      setLoading(false);
    }, 500);
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h3>{t.chatbotTitle}</h3>
        <p className="hint">{t.chatbotHint}</p>
      </div>
      <div className="chatbot-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-${msg.role}`}>
            <div className="chat-content">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-assistant">
            <div className="chat-content">{t.thinking}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chatbot-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder={t.chatbotPlaceholder}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {t.send}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [language, setLanguage] = useState("de");
  const t = translations[language];

  const [cvText, setCvText] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [profile, setProfile] = useState({
    titles: [],
    titlesRaw: "",
    skills: [],
    directions: [],
    alternativeTitles: [],
    location: "",
  });

  const [links, setLinks] = useState([]);
  const [customPortals, setCustomPortals] = useState([]);
  const [showAddPortal, setShowAddPortal] = useState(false);
  const [newPortal, setNewPortal] = useState({ name: "", url: "" });
  const [copiedTitle, setCopiedTitle] = useState(null);
  const [linkViewMode, setLinkViewMode] = useState("auto"); // "auto", "table", or "list"
  const [linkSearchFilter, setLinkSearchFilter] = useState("");

  // Application Tracker
  const [applications, setApplications] = useState(() => {
    const saved = localStorage.getItem("jobSearchApplications");
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddApplication, setShowAddApplication] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [newApplication, setNewApplication] = useState({
    company: "",
    position: "",
    appliedDate: new Date().toISOString().split("T")[0],
    status: "applied",
    notes: "",
    jobLink: "",
  });

  // Company Research
  const [companySearch, setCompanySearch] = useState("");

  // Multi-Profile Support
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem("jobSearchProfiles");
    return saved ? JSON.parse(saved) : {};
  });
  const [currentProfileName, setCurrentProfileName] = useState("default");
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  // Load profile from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem(`jobSearchProfile_${currentProfileName}`);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile(parsed);
        setCvText(parsed.cvText || "");
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    }
  }, [currentProfileName]);

  // Save applications to localStorage
  useEffect(() => {
    localStorage.setItem("jobSearchApplications", JSON.stringify(applications));
  }, [applications]);

  // Save current profile to localStorage
  useEffect(() => {
    if (currentProfileName) {
      const profileToSave = {
        ...profile,
        cvText,
        customPortals,
      };
      localStorage.setItem(`jobSearchProfile_${currentProfileName}`, JSON.stringify(profileToSave));
    }
  }, [profile, cvText, customPortals, currentProfileName]);

  const handleAnalyzeCv = () => {
    if (!cvText.trim()) {
      alert(t.noCvText);
      return;
    }

    const extracted = extractFromCv(cvText);
    setProfile((prev) => ({
      ...prev,
      ...extracted,
      titlesRaw: extracted.titles.join("\n"),
      location: extracted.locationHint || prev.location || "",
    }));
  };

  const handleCvFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert(t.invalidPdf);
      return;
    }

    try {
      setLoadingPdf(true);
      const text = await readPdfFile(file);

      if (!text.trim()) {
        alert(t.pdfReadError);
        return;
      }

      setCvText(text);
    } catch (error) {
      console.error(error);
      alert(t.pdfReadError);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Job titles: keep raw text; parse on generate
  const handleTitlesChange = (e) => {
    const raw = e.target.value;
    setProfile((prev) => ({
      ...prev,
      titlesRaw: raw,
    }));
  };

  const parseTitles = () => {
    const raw = profile.titlesRaw ?? "";
    if (!raw.trim()) return profile.titles || [];

    const items = raw
      .split(/\n/)
      .flatMap((line) => line.split(","))
      .map((s) => s.trim())
      .filter(Boolean);

    return items;
  };

  const handleSkillsChange = (e) => {
    const rawValue = e.target.value;
    setProfile((prev) => ({
      ...prev,
      skillsRaw: rawValue,
    }));
  };

  const handleSkillsBlur = () => {
    const tags = profile.skillsRaw
      ? profile.skillsRaw
        .split(",")
        .map((s) => s.trim().replace(/\s+/g, " ")) // Fix broken words with extra spaces
        .filter(Boolean)
        .filter(s => s.length >= 2) // Filter out very short entries
      : profile.skills;

    setProfile((prev) => ({
      ...prev,
      skills: tags.length ? tags : [],
      skillsRaw: undefined,
    }));
  };

  const handleLocationChange = (e) => {
    const value = e.target.value;
    setProfile((prev) => ({
      ...prev,
      location: value,
    }));
  };

  const handleAddCustomPortal = () => {
    if (newPortal.name && newPortal.url) {
      setCustomPortals([...customPortals, { ...newPortal, id: Date.now() }]);
      setNewPortal({ name: "", url: "" });
      setShowAddPortal(false);
    }
  };

  const handleRemoveCustomPortal = (id) => {
    setCustomPortals(customPortals.filter((p) => p.id !== id));
  };

  const handleGenerateLinks = () => {
    const titles = parseTitles();

    if (!titles || titles.length === 0) {
      alert(
        language === "de"
          ? "Bitte füge mindestens einen Jobtitel hinzu."
          : "Please add at least one job title."
      );
      return;
    }

    // Skills are not used anymore - keep empty array
    const parsedSkills = profile.skills || [];

    // sync titles array back into profile
    setProfile((prev) => ({
      ...prev,
      titles,
      titlesRaw: prev.titlesRaw ?? titles.join("\n"),
    }));

    // One set of links per title (no work modes)
    const newLinks = titles.map((title) => {
      const linkObj = {
        title,
        indeed: buildIndeedUrl(title, profile.location),
        stepstone: buildStepstoneUrl(title, profile.location),
        linkedin: buildLinkedInUrl(title, profile.location, parsedSkills),
      };

      customPortals.forEach((portal) => {
        linkObj[`custom_${portal.id}`] = {
          name: portal.name,
          url: buildCustomPortalUrl(
            portal,
            title,
            profile.location,
            parsedSkills
          ),
        };
      });

      return linkObj;
    });

    setLinks(newLinks);
  };

  const handleCopyTitle = (title) => {
    navigator.clipboard.writeText(title);
    setCopiedTitle(title);
    setTimeout(() => setCopiedTitle(null), 2000);
  };

  // Application Tracker handlers
  const handleAddApplication = () => {
    if (!newApplication.company || !newApplication.position) {
      alert(language === "de" ? "Bitte gib mindestens Firma und Position ein." : "Please enter at least company and position.");
      return;
    }
    const app = {
      ...newApplication,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    setApplications([...applications, app]);
    setNewApplication({
      company: "",
      position: "",
      appliedDate: new Date().toISOString().split("T")[0],
      status: "applied",
      notes: "",
      jobLink: "",
    });
    setShowAddApplication(false);
    alert(t.applicationSaved);
  };

  const handleEditApplication = (app) => {
    setEditingApp(app);
    setNewApplication({ ...app });
    setShowAddApplication(true);
  };

  const handleUpdateApplication = () => {
    if (!newApplication.company || !newApplication.position) {
      alert(language === "de" ? "Bitte gib mindestens Firma und Position ein." : "Please enter at least company and position.");
      return;
    }
    setApplications(applications.map(app =>
      app.id === editingApp.id ? { ...newApplication, id: app.id, createdAt: app.createdAt } : app
    ));
    setEditingApp(null);
    setNewApplication({
      company: "",
      position: "",
      appliedDate: new Date().toISOString().split("T")[0],
      status: "applied",
      notes: "",
      jobLink: "",
    });
    setShowAddApplication(false);
    alert(t.applicationSaved);
  };

  const handleDeleteApplication = (id) => {
    if (confirm(language === "de" ? "Bewerbung wirklich löschen?" : "Really delete this application?")) {
      setApplications(applications.filter(app => app.id !== id));
      alert(t.applicationDeleted);
    }
  };

  // Multi-Profile handlers
  const handleSaveProfile = () => {
    if (!newProfileName.trim()) {
      alert(language === "de" ? "Bitte gib einen Profilnamen ein." : "Please enter a profile name.");
      return;
    }
    const profileToSave = {
      ...profile,
      cvText,
      customPortals,
      name: newProfileName.trim(),
    };
    const updatedProfiles = { ...profiles, [newProfileName.trim()]: profileToSave };
    setProfiles(updatedProfiles);
    localStorage.setItem("jobSearchProfiles", JSON.stringify(updatedProfiles));
    setNewProfileName("");
    alert(t.profileSaved);
  };

  const handleLoadProfile = (profileName) => {
    const profileToLoad = profiles[profileName];
    if (profileToLoad) {
      setProfile(profileToLoad);
      setCvText(profileToLoad.cvText || "");
      setCustomPortals(profileToLoad.customPortals || []);
      setCurrentProfileName(profileName);
      setShowProfileManager(false);
      alert(t.profileLoaded);
    }
  };

  const handleDeleteProfile = (profileName) => {
    if (profileName === "default") {
      alert(language === "de" ? "Das Standard-Profil kann nicht gelöscht werden." : "The default profile cannot be deleted.");
      return;
    }
    if (confirm(language === "de" ? `Profil "${profileName}" wirklich löschen?` : `Really delete profile "${profileName}"?`)) {
      const updatedProfiles = { ...profiles };
      delete updatedProfiles[profileName];
      setProfiles(updatedProfiles);
      localStorage.setItem("jobSearchProfiles", JSON.stringify(updatedProfiles));
      if (currentProfileName === profileName) {
        setCurrentProfileName("default");
        setProfile({
          titles: [],
          titlesRaw: "",
          skills: [],
          directions: [],
          alternativeTitles: [],
          location: "",
        });
        setCvText("");
      }
      alert(t.profileDeleted);
    }
  };

  const handleExportProfile = () => {
    const profileToExport = {
      ...profile,
      cvText,
      customPortals,
      name: currentProfileName,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(profileToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-search-profile-${currentProfileName}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProfile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        setProfile(imported);
        setCvText(imported.cvText || "");
        setCustomPortals(imported.customPortals || []);
        if (imported.name) {
          setCurrentProfileName(imported.name);
          const updatedProfiles = { ...profiles, [imported.name]: imported };
          setProfiles(updatedProfiles);
          localStorage.setItem("jobSearchProfiles", JSON.stringify(updatedProfiles));
        }
        alert(t.profileLoaded);
      } catch (error) {
        alert(language === "de" ? "Fehler beim Laden des Profils." : "Error loading profile.");
      }
    };
    reader.readAsText(file);
  };

  // Company Research Helper
  const buildCompanyResearchLinks = (companyName) => {
    const encoded = encodeURIComponent(companyName);
    return {
      linkedin: `https://www.linkedin.com/search/results/companies/?keywords=${encoded}`,
      glassdoor: `https://www.glassdoor.com/Search/results.htm?keyword=${encoded}`,
    };
  };

  const handleCopyAllLinks = () => {
    const allLinksText = links
      .map((item, idx) => {
        const portals = [
          `${t.indeed}: ${item.indeed}`,
          `${t.stepstone}: ${item.stepstone}`,
          `${t.linkedin}: ${item.linkedin}`,
        ];

        Object.keys(item)
          .filter((key) => key.startsWith("custom_"))
          .forEach((key) => {
            const custom = item[key];
            portals.push(`${custom.name}: ${custom.url}`);
          });

        return `${idx + 1}. ${item.title}\n${portals.join("\n")}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(allLinksText);
    setCopiedTitle("all");
    setTimeout(() => setCopiedTitle(null), 2000);
  };

  // Filter links based on search
  const filteredLinks = linkSearchFilter
    ? links.filter((item) =>
      item.title.toLowerCase().includes(linkSearchFilter.toLowerCase())
    )
    : links;

  // Determine view mode: auto-switch to table if more than 5 links
  const shouldUseTableView =
    linkViewMode === "table" ||
    (linkViewMode === "auto" && links.length > 5);

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-logo-wrap">
            <img src={iraLogo} alt="Ira H – coffee & code" className="brand-logo" />
          </div>
          <div className="app-title-block">
            <h1>{t.title}</h1>
            <p className="app-subtitle">{t.subtitle}</p>
          </div>
        </div>

        <div className="header-controls">
          <div className="language-toggle">
            <button
              className={`lang-btn ${language === "de" ? "active" : ""}`}
              onClick={() => setLanguage("de")}
            >
              DE
            </button>
            <button
              className={`lang-btn ${language === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
          <button
            className="primary-btn"
            onClick={() => setShowProfileManager(!showProfileManager)}
            style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
          >
            {t.profiles}
          </button>
        </div>
      </header>

      {showProfileManager && (
        <section className="panel" style={{ margin: "1rem 0", padding: "1.5rem", backgroundColor: "rgba(15, 23, 42, 0.5)", borderRadius: "8px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>{t.profiles}</h3>
            <button
              onClick={() => setShowProfileManager(false)}
              style={{
                background: "transparent",
                border: "1px solid var(--ira-border-subtle)",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--ira-text-main)",
                fontSize: "1.2rem",
                lineHeight: "1",
                transition: "all 0.2s",
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(249, 115, 22, 0.15)";
                e.currentTarget.style.borderColor = "var(--ira-accent)";
                e.currentTarget.style.color = "var(--ira-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "var(--ira-border-subtle)";
                e.currentTarget.style.color = "var(--ira-text-main)";
              }}
              title={language === "de" ? "Schließen" : "Close"}
            >
              ×
            </button>
          </div>

          {/* Explanation */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "rgba(249, 115, 22, 0.08)",
            border: "1px solid rgba(249, 115, 22, 0.2)",
            borderRadius: "0.75rem",
            borderLeft: "3px solid var(--ira-accent)"
          }}>
            <p style={{
              margin: "0 0 0.75rem 0",
              fontSize: "0.95rem",
              color: "var(--ira-text-main)",
              lineHeight: "1.6"
            }}>
              {t.profileExplanation}
            </p>
            <div style={{ marginTop: "0.75rem" }}>
              <p style={{
                margin: "0 0 0.5rem 0",
                fontSize: "0.85rem",
                fontWeight: "600",
                color: "var(--ira-accent)",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                {t.howToUseProfiles}
              </p>
              <ul style={{
                margin: "0 0 0.75rem 0",
                paddingLeft: "1.25rem",
                fontSize: "0.85rem",
                color: "var(--ira-text-muted)",
                lineHeight: "1.8"
              }}>
                <li>{t.profileStep1}</li>
                <li>{t.profileStep2}</li>
                <li>{t.profileStep3}</li>
              </ul>
              <p style={{
                margin: "0.75rem 0 0 0",
                fontSize: "0.85rem",
                color: "var(--ira-accent)",
                fontStyle: "italic",
                paddingTop: "0.75rem",
                borderTop: "1px solid rgba(249, 115, 22, 0.2)"
              }}>
                {t.profileTip}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                {t.currentProfile}: {currentProfileName === "default" ? t.defaultProfile : currentProfileName}
              </label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {Object.keys(profiles).map((name) => (
                  <button
                    key={name}
                    className={`${currentProfileName === name ? "primary-btn" : "secondary-btn"}`}
                    onClick={() => handleLoadProfile(name)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                {t.newProfile}
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder={t.profileName}
                  style={{ flex: "1", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--ira-border-subtle)", background: "rgba(15, 23, 42, 0.6)", color: "var(--ira-text-main)" }}
                />
                <button className="primary-btn" onClick={handleSaveProfile} style={{ fontSize: "0.85rem" }}>
                  {t.saveProfile}
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="secondary-btn" onClick={handleExportProfile} style={{ fontSize: "0.85rem" }}>
              {t.exportProfile}
            </button>
            <label className="secondary-btn" style={{ fontSize: "0.85rem", cursor: "pointer" }}>
              {t.importProfile}
              <input
                type="file"
                accept=".json"
                onChange={handleImportProfile}
                style={{ display: "none" }}
              />
            </label>
            {Object.keys(profiles).filter(name => name !== "default").map((name) => (
              <button
                key={name}
                className="secondary-btn"
                onClick={() => handleDeleteProfile(name)}
                style={{ fontSize: "0.85rem", backgroundColor: "#ff6b6b", color: "white" }}
              >
                {t.deleteProfile}: {name}
              </button>
            ))}
          </div>
        </section>
      )}

      <main className="app-layout">
        {/* Left: CV */}
        <section className="panel panel-left">
          <h2>{t.step1}</h2>

          <div className="file-upload" style={{
            border: "2px dashed var(--ira-border-subtle)",
            borderRadius: "12px",
            padding: "2rem 1.5rem",
            textAlign: "center",
            marginBottom: "1.5rem",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            transition: "all 0.3s ease",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden"
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ira-accent)";
              e.currentTarget.style.backgroundColor = "rgba(249, 115, 22, 0.1)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(249, 115, 22, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ira-border-subtle)";
              e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.6)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <label htmlFor="cv-file-input" className="file-label" style={{
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              width: "100%"
            }}>
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "var(--ira-accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                boxShadow: "0 4px 12px rgba(249, 115, 22, 0.2)"
              }}>
                📄
              </div>
              <span style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--ira-text-main)" }}>
                {t.uploadPdf}
              </span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleCvFile}
                style={{ display: "none" }}
                id="cv-file-input"
              />
              <span style={{ fontSize: "0.9rem", color: "var(--ira-text-muted)", maxWidth: "300px" }}>
                {language === "de"
                  ? "Klicke hier, um dein CV als PDF hochzuladen"
                  : "Click here to upload your CV as PDF"}
              </span>
            </label>
            {loadingPdf && <p className="hint" style={{ marginTop: "0.5rem" }}>{t.loadingPdf}</p>}
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            margin: "1.5rem 0",
            color: "var(--ira-text-muted)"
          }}>
            <div style={{ flex: "1", height: "1px", background: "var(--ira-border-subtle)" }}></div>
            <span style={{ fontSize: "0.85rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {language === "de" ? "oder" : "or"}
            </span>
            <div style={{ flex: "1", height: "1px", background: "var(--ira-border-subtle)" }}></div>
          </div>

          <textarea
            className="cv-textarea"
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder={t.cvPlaceholder}
          />

          <button className="primary-btn" onClick={handleAnalyzeCv} style={{ width: "100%" }}>
            {t.analyzeButton}
          </button>

          {cvText && (
            <div style={{
              marginTop: "1rem",
              padding: "0.875rem 1rem",
              borderRadius: "0.75rem",
              background: "var(--ira-accent-soft)",
              border: "1px solid var(--ira-accent)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}>
              <span style={{ fontSize: "1.2rem" }}>✓</span>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ira-text-main)", lineHeight: "1.5" }}>
                {language === "de"
                  ? "CV geladen. Du kannst jetzt die Chatbot-Funktion nutzen, um Stellenanzeigen zu analysieren."
                  : "CV loaded. You can now use the chatbot feature to analyze job ads."}
              </p>
            </div>
          )}
        </section>

        {/* Right: profile */}
        <section className="panel panel-right">
          <h2>{t.step2}</h2>

          {profile.directions && profile.directions.length > 0 && (
            <div className="field-group">
              <label>{t.directions}</label>
              <div className="directions-tags">
                {profile.directions.map((dir) => (
                  <span key={dir} className="direction-tag">
                    {t[dir] || dir}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="field-group">
            <label>
              {t.jobTitles}{" "}
              <span className="field-hint">
                - {language === "de" ? "voll editierbar" : "fully editable"}
              </span>
            </label>
            <textarea
              className="small-textarea"
              value={
                profile.titlesRaw !== undefined
                  ? profile.titlesRaw
                  : profile.titles.join("\n")
              }
              onChange={handleTitlesChange}
              placeholder={t.jobTitlesPlaceholder}
            />
            <p className="hint" style={{ marginTop: "0.25rem" }}>
              {t.jobTitlesHint}
            </p>
          </div>

          <div className="field-group">
            <label>{t.location}</label>
            <input
              type="text"
              className="text-input"
              value={profile.location}
              onChange={handleLocationChange}
              placeholder={t.locationPlaceholder}
            />
            <p
              className="hint"
              style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}
            >
              {t.locationHint}
            </p>
          </div>

          {/* Custom portals */}
          <div className="field-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <label style={{ margin: 0 }}>
                {language === "de"
                  ? "Weitere Job-Portale hinzufügen"
                  : "Add custom job portals"}
              </label>
              <button
                type="button"
                className="small-btn"
                onClick={() => setShowAddPortal(!showAddPortal)}
              >
                {showAddPortal ? t.cancel : `+ ${t.addPortal}`}
              </button>
            </div>
            {showAddPortal && (
              <div className="custom-portal-form">
                <input
                  type="text"
                  className="text-input"
                  placeholder={t.portalName}
                  value={newPortal.name}
                  onChange={(e) =>
                    setNewPortal({ ...newPortal, name: e.target.value })
                  }
                  style={{ marginBottom: "0.5rem" }}
                />
                <input
                  type="text"
                  className="text-input"
                  placeholder={t.portalUrl}
                  value={newPortal.url}
                  onChange={(e) =>
                    setNewPortal({ ...newPortal, url: e.target.value })
                  }
                  style={{ marginBottom: "0.5rem" }}
                />
                <p
                  className="hint"
                  style={{ marginBottom: "0.5rem", fontSize: "0.75rem" }}
                >
                  {t.portalHint}
                </p>
                <button
                  type="button"
                  className="small-btn primary"
                  onClick={handleAddCustomPortal}
                  disabled={!newPortal.name || !newPortal.url}
                >
                  {t.addPortal}
                </button>
              </div>
            )}
            {customPortals.length > 0 && (
              <div className="custom-portals-list">
                {customPortals.map((portal) => (
                  <div key={portal.id} className="custom-portal-item">
                    <span>{portal.name}</span>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemoveCustomPortal(portal.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="secondary-btn" onClick={handleGenerateLinks}>
            {t.generateButton}
          </button>

          {links.length > 0 && (
            <div className="links-block">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>{t.step3}</h3>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  {links.length > 5 && (
                    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                      <button
                        type="button"
                        className={`small-btn ${linkViewMode === "table" ? "primary" : ""}`}
                        onClick={() => setLinkViewMode("table")}
                        style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                      >
                        {t.tableView}
                      </button>
                      <button
                        type="button"
                        className={`small-btn ${linkViewMode === "list" ? "primary" : ""}`}
                        onClick={() => setLinkViewMode("list")}
                        style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                      >
                        {t.listView}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="small-btn"
                    onClick={handleCopyAllLinks}
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                    title={copiedTitle === "all" ? t.copyAllSuccess : t.copyAllLinks}
                  >
                    {copiedTitle === "all" ? "✓ " : ""}{t.copyAllLinks}
                  </button>
                </div>
              </div>

              {links.length > 5 && (
                <div style={{ marginBottom: "1rem" }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder={t.searchLinks}
                    value={linkSearchFilter}
                    onChange={(e) => setLinkSearchFilter(e.target.value)}
                    style={{ width: "100%", fontSize: "0.9rem" }}
                  />
                  {linkSearchFilter && (
                    <p className="hint" style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                      {t.showing} {filteredLinks.length} {t.of} {links.length} {t.links}
                    </p>
                  )}
                </div>
              )}

              <p className="hint" style={{ marginBottom: "1rem" }}>
                {language === "de"
                  ? "Jede Zeile ist ein Jobtitel – mit vorbereiteten Suchen auf den großen Portalen."
                  : "Each row is a job title – with prepared searches on the major portals."}
              </p>

              {profile.alternativeTitles &&
                profile.alternativeTitles.length > 0 && (
                  <div className="alternative-titles-block" style={{ marginBottom: "1.5rem" }}>
                    <h4>{t.alternativeTitles}</h4>
                    <p
                      className="hint"
                      style={{
                        fontSize: "0.8rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {t.alternativeTitlesHint}
                    </p>
                    <div className="alternative-titles-list">
                      {profile.alternativeTitles.map((title, idx) => (
                        <button
                          key={idx}
                          className="alternative-title-btn"
                          onClick={() => handleCopyTitle(title)}
                          title={copiedTitle === title ? t.copied : title}
                        >
                          {title}
                          {copiedTitle === title && (
                            <span className="copied-badge">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {shouldUseTableView && links.length > 3 ? (
                // Table view for many links
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--ira-border-subtle)", textAlign: "left" }}>
                        <th style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>
                          {language === "de" ? "Jobtitel" : "Job Title"}
                        </th>
                        <th style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{t.indeed}</th>
                        <th style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{t.stepstone}</th>
                        <th style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{t.linkedin}</th>
                        {customPortals.length > 0 && customPortals.map((portal) => (
                          <th key={portal.id} style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>
                            {portal.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map((item, idx) => (
                        <tr
                          key={`${item.title}-${idx}`}
                          style={{
                            borderBottom: "1px solid var(--ira-border-subtle)",
                            transition: "background-color 0.2s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(249, 115, 22, 0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <td style={{ padding: "0.75rem 0.5rem", fontWeight: "500" }}>
                            {item.title}
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <a
                              href={item.indeed}
                              target="_blank"
                              rel="noreferrer"
                              className="link-btn"
                              style={{ display: "inline-block", fontSize: "0.85rem", padding: "0.3rem 0.6rem" }}
                            >
                              {t.indeed}
                            </a>
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <a
                              href={item.stepstone}
                              target="_blank"
                              rel="noreferrer"
                              className="link-btn"
                              style={{ display: "inline-block", fontSize: "0.85rem", padding: "0.3rem 0.6rem" }}
                            >
                              {t.stepstone}
                            </a>
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <a
                              href={item.linkedin}
                              target="_blank"
                              rel="noreferrer"
                              className="link-btn"
                              style={{ display: "inline-block", fontSize: "0.85rem", padding: "0.3rem 0.6rem" }}
                            >
                              {t.linkedin}
                            </a>
                          </td>
                          {customPortals.map((portal) => {
                            const customKey = `custom_${portal.id}`;
                            const custom = item[customKey];
                            if (!custom) return null;
                            return (
                              <td key={portal.id} style={{ padding: "0.75rem 0.5rem" }}>
                                <a
                                  href={custom.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="link-btn"
                                  style={{ display: "inline-block", fontSize: "0.85rem", padding: "0.3rem 0.6rem" }}
                                >
                                  {custom.name}
                                </a>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // List view for few links
                <ul className="links-list">
                  {filteredLinks.map((item, idx) => (
                    <li
                      key={`${item.title}-${idx}`}
                      className="links-item"
                    >
                      <div className="links-title">{item.title}</div>
                      <div className="links-buttons">
                        <a
                          href={item.indeed}
                          target="_blank"
                          rel="noreferrer"
                          className="link-btn"
                        >
                          {t.indeed}
                        </a>
                        <a
                          href={item.stepstone}
                          target="_blank"
                          rel="noreferrer"
                          className="link-btn"
                        >
                          {t.stepstone}
                        </a>
                        <a
                          href={item.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="link-btn"
                        >
                          {t.linkedin}
                        </a>
                        {Object.keys(item)
                          .filter((key) => key.startsWith("custom_"))
                          .map((key) => {
                            const custom = item[key];
                            return (
                              <a
                                key={key}
                                href={custom.url}
                                target="_blank"
                                rel="noreferrer"
                                className="link-btn"
                              >
                                {custom.name}
                              </a>
                            );
                          })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {filteredLinks.length === 0 && linkSearchFilter && (
                <p className="hint" style={{ textAlign: "center", padding: "2rem", color: "var(--ira-text-muted)" }}>
                  {language === "de"
                    ? "Keine Jobtitel gefunden, die '" + linkSearchFilter + "' enthalten."
                    : "No job titles found containing '" + linkSearchFilter + "'."}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      {cvText && (
        <section className="panel panel-chatbot">
          <Chatbot
            profile={profile}
            onProfileUpdate={setProfile}
            cvText={cvText}
            language={language}
            t={t}
          />
        </section>
      )}

      {/* Application Tracker */}
      <section className="panel" style={{ margin: "1rem 0", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>{t.applicationTracker}</h2>
          <button
            className="primary-btn"
            onClick={() => {
              setShowAddApplication(!showAddApplication);
              setEditingApp(null);
              setNewApplication({
                company: "",
                position: "",
                appliedDate: new Date().toISOString().split("T")[0],
                status: "applied",
                notes: "",
                jobLink: "",
              });
            }}
          >
            {t.addApplication}
          </button>
        </div>

        {/* Explanation */}
        <div style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          background: "rgba(249, 115, 22, 0.08)",
          border: "1px solid rgba(249, 115, 22, 0.2)",
          borderRadius: "0.75rem",
          borderLeft: "3px solid var(--ira-accent)"
        }}>
          <p style={{
            margin: "0 0 0.75rem 0",
            fontSize: "0.95rem",
            color: "var(--ira-text-main)",
            lineHeight: "1.6"
          }}>
            {t.applicationTrackerExplanation}
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{
              margin: "0 0 0.5rem 0",
              fontSize: "0.85rem",
              fontWeight: "600",
              color: "var(--ira-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              {t.applicationTrackerHowTo}
            </p>
            <ul style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.85rem",
              color: "var(--ira-text-muted)",
              lineHeight: "1.8"
            }}>
              <li>{t.applicationStep1}</li>
              <li>{t.applicationStep2}</li>
              <li>{t.applicationStep3}</li>
            </ul>
          </div>
        </div>

        {showAddApplication && (
          <div style={{
            padding: "1.75rem",
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            borderRadius: "12px",
            marginBottom: "1.5rem",
            border: "1.5px solid var(--ira-border-subtle)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{
                  display: "block",
                  marginBottom: "0.625rem",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "var(--ira-text-main)",
                  letterSpacing: "0.01em"
                }}>
                  {t.company} <span style={{ color: "var(--ira-accent)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={newApplication.company}
                  onChange={(e) => setNewApplication({ ...newApplication, company: e.target.value })}
                  className="text-input"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    border: "1.5px solid var(--ira-border-subtle)",
                    background: "rgba(15, 23, 42, 0.8)",
                    color: "var(--ira-text-main)",
                    fontSize: "0.95rem",
                    transition: "all 0.3s ease"
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: "block",
                  marginBottom: "0.625rem",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "var(--ira-text-main)",
                  letterSpacing: "0.01em"
                }}>
                  {t.position} <span style={{ color: "var(--ira-accent)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={newApplication.position}
                  onChange={(e) => setNewApplication({ ...newApplication, position: e.target.value })}
                  className="text-input"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    border: "1.5px solid var(--ira-border-subtle)",
                    background: "rgba(15, 23, 42, 0.8)",
                    color: "var(--ira-text-main)",
                    fontSize: "0.95rem",
                    transition: "all 0.3s ease"
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: "block",
                  marginBottom: "0.625rem",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "var(--ira-text-main)",
                  letterSpacing: "0.01em"
                }}>
                  {t.appliedDate}
                </label>
                <input
                  type="date"
                  value={newApplication.appliedDate}
                  onChange={(e) => setNewApplication({ ...newApplication, appliedDate: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    border: "1.5px solid var(--ira-border-subtle)",
                    background: "rgba(15, 23, 42, 0.8)",
                    color: "var(--ira-text-main)",
                    fontSize: "0.95rem",
                    transition: "all 0.3s ease"
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: "block",
                  marginBottom: "0.625rem",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "var(--ira-text-main)",
                  letterSpacing: "0.01em"
                }}>
                  {t.status}
                </label>
                <select
                  value={newApplication.status}
                  onChange={(e) => setNewApplication({ ...newApplication, status: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    border: "1.5px solid var(--ira-border-subtle)",
                    background: "rgba(15, 23, 42, 0.8)",
                    color: "var(--ira-text-main)",
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                >
                  <option value="applied">{t.applied}</option>
                  <option value="interview">{t.interview}</option>
                  <option value="offer">{t.offer}</option>
                  <option value="rejected">{t.rejected}</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{
                display: "block",
                marginBottom: "0.625rem",
                fontWeight: "600",
                fontSize: "0.9rem",
                color: "var(--ira-text-main)",
                letterSpacing: "0.01em"
              }}>
                {t.jobLink}
              </label>
              <input
                type="url"
                value={newApplication.jobLink}
                onChange={(e) => setNewApplication({ ...newApplication, jobLink: e.target.value })}
                placeholder="https://..."
                className="text-input"
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "1.5px solid var(--ira-border-subtle)",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "var(--ira-text-main)",
                  fontSize: "0.95rem",
                  transition: "all 0.3s ease"
                }}
              />
            </div>
            <div style={{ marginBottom: "1.75rem" }}>
              <label style={{
                display: "block",
                marginBottom: "0.625rem",
                fontWeight: "600",
                fontSize: "0.9rem",
                color: "var(--ira-text-main)",
                letterSpacing: "0.01em"
              }}>
                {t.notes}
              </label>
              <textarea
                value={newApplication.notes}
                onChange={(e) => setNewApplication({ ...newApplication, notes: e.target.value })}
                placeholder={language === "de" ? "Notizen zur Bewerbung..." : "Notes about this application..."}
                className="small-textarea"
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "8px",
                  border: "1.5px solid var(--ira-border-subtle)",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "var(--ira-text-main)",
                  fontSize: "0.95rem",
                  minHeight: "100px",
                  lineHeight: "1.6",
                  resize: "vertical",
                  transition: "all 0.3s ease"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--ira-border-subtle)" }}>
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowAddApplication(false);
                  setEditingApp(null);
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: "500"
                }}
              >
                {t.cancel}
              </button>
              <button
                className="primary-btn"
                onClick={editingApp ? handleUpdateApplication : handleAddApplication}
                style={{
                  padding: "0.75rem 1.75rem",
                  fontSize: "0.9rem",
                  fontWeight: "600"
                }}
              >
                {t.save}
              </button>
            </div>
          </div>
        )}

        {applications.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--ira-text-muted)", padding: "2rem" }}>{t.noApplications}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--ira-border-subtle)" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600" }}>{t.company}</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600" }}>{t.position}</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600" }}>{t.appliedDate}</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600" }}>{t.status}</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600" }}>{t.notes}</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600" }}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {applications
                  .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
                  .map((app) => (
                    <tr key={app.id} style={{ borderBottom: "1px solid var(--ira-border-subtle)" }}>
                      <td style={{ padding: "0.75rem" }}>
                        <strong>{app.company}</strong>
                        {app.jobLink && (
                          <a href={app.jobLink} target="_blank" rel="noreferrer" style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                            🔗
                          </a>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>{app.position}</td>
                      <td style={{ padding: "0.75rem" }}>{app.appliedDate}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                            backgroundColor:
                              app.status === "offer"
                                ? "#4caf50"
                                : app.status === "interview"
                                  ? "#2196f3"
                                  : app.status === "rejected"
                                    ? "#f44336"
                                    : "#ff9800",
                            color: "white",
                          }}
                        >
                          {t[app.status]}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {app.notes || "-"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            className="secondary-btn"
                            onClick={() => handleEditApplication(app)}
                            style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                          >
                            {t.edit}
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={() => handleDeleteApplication(app.id)}
                            style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem", backgroundColor: "#f44336", color: "white" }}
                          >
                            {t.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Company Research Helper */}
      <section className="panel" style={{ margin: "1rem 0", padding: "1.5rem" }}>
        <h2>{t.companyResearch}</h2>

        {/* Explanation */}
        <div style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          background: "rgba(249, 115, 22, 0.08)",
          border: "1px solid rgba(249, 115, 22, 0.2)",
          borderRadius: "0.75rem",
          borderLeft: "3px solid var(--ira-accent)"
        }}>
          <p style={{
            margin: "0 0 0.75rem 0",
            fontSize: "0.95rem",
            color: "var(--ira-text-main)",
            lineHeight: "1.6"
          }}>
            {t.companyResearchExplanation}
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{
              margin: "0 0 0.5rem 0",
              fontSize: "0.85rem",
              fontWeight: "600",
              color: "var(--ira-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              {t.companyResearchHowTo}
            </p>
            <ul style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.85rem",
              color: "var(--ira-text-muted)",
              lineHeight: "1.8"
            }}>
              <li>{t.companyStep1}</li>
              <li>{t.companyStep2}</li>
              <li>{t.companyStep3}</li>
            </ul>
          </div>
        </div>

        <p className="hint" style={{ marginBottom: "1rem" }}>{t.searchInfo}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            type="text"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            placeholder={t.searchCompany}
            style={{ flex: "1", padding: "0.75rem", borderRadius: "4px", border: "1px solid var(--ira-border-subtle)", background: "rgba(15, 23, 42, 0.6)", color: "var(--ira-text-main)" }}
            onKeyPress={(e) => {
              if (e.key === "Enter" && companySearch.trim()) {
                const links = buildCompanyResearchLinks(companySearch);
                window.open(links.linkedin, "_blank");
              }
            }}
          />
        </div>
        {companySearch.trim() && (
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {(() => {
              const links = buildCompanyResearchLinks(companySearch);
              return (
                <>
                  <a
                    href={links.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    🔗 {t.companyLinkedIn}
                  </a>
                  <a
                    href={links.glassdoor}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    🔗 {t.companyGlassdoor}
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(companySearch + " company website")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    🔍 {t.companyWebsite}
                  </a>
                </>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
