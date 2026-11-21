// Entry point: styles, the icon sprite and the router.
import "./ui/styles.css";
import { createBrief } from "./ui/Brief";
import { h, installSprite } from "./ui/dom";
import { createLibrary } from "./ui/Library";
import { createPlay } from "./ui/Play";
import { createRecap } from "./ui/Recap";
import { paths } from "./ui/routes";
import { resolveScenario } from "./ui/scenarios";
import { createAuthor } from "./ui/Author";
import { createAuthorList } from "./ui/AuthorList";
import { createImportShare } from "./ui/ImportShare";
import { startRouter, type Screen } from "./ui/router";

function textScreen(title: string, message: string): Screen {
  return {
    title,
    element: h(
      "div",
      { class: "text-col" },
      h("h1", {}, message),
      h("p", {}, h("a", { class: "tap", href: paths.library() }, "Back to library")),
    ),
  };
}

const root = document.getElementById("app");
if (root) {
  document.documentElement.classList.add("js");
  installSprite();
  startRouter(root, async (route) => {
    switch (route.name) {
      case "library":
        return createLibrary();
      case "brief": {
        const entry = await resolveScenario(route.id);
        return entry ? createBrief(entry.scenario, entry.listed) : textScreen("Scenario not found", "Scenario not found");
      }
      case "play": {
        const entry = await resolveScenario(route.id);
        return entry ? createPlay(entry.scenario) : textScreen("Scenario not found", "Scenario not found");
      }
      case "recap": {
        const entry = await resolveScenario(route.id);
        return entry ? createRecap(entry.scenario, route.sessionId) : textScreen("Scenario not found", "Scenario not found");
      }
      case "import":
        return createImportShare();
      case "author":
        return createAuthorList();
      case "author-edit":
        return createAuthor(route.id);
      default:
        return textScreen("Page not found", "Page not found");
    }
  });
}
