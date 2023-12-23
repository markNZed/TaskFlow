/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "#src/utils";

function removeLastSegment(str) {
  let segments = str.split('.');
  segments.pop(); // Remove the last element
  return segments.join('.'); // Join the remaining elements
}

function questionAnswered(questionnaire) {
  for (const skey in questionnaire) {
    if (questionnaire[skey]["questions"]) {
      for (const qkey in questionnaire[skey]["questions"]) {
        if (questionnaire[skey]["questions"][qkey].answer) {
          return true;
        }
      }
    }
  }
  return false;
}

const choose = function(T) {
  if (T("name") === "choose-overview") {
    let id;
    // Check if the questionnaire is empty
    const questionnaire = T("shared.family.questionnaire");
    if (!questionAnswered(questionnaire)) {
      utils.logTask(T(), `Questionnaire empty`);
      id = removeLastSegment(T("id")) + ".overview";
    } else {
      id = removeLastSegment(T("id")) + ".overview-prefilled";
    }
    console.log("choose id", id);
    T("commandArgs", {"nextTaskId": id, "done": true});
    T("command", "update");
    T("commandDescription", "choose next task:" + id);
    return T();
  }
  if (T("name") === "choose-review") {
    // Check if the user added any information if not then skip review and go to interview
    // But that will raise issues for setting the interviewStep
    return T();
  }
}

export { choose };