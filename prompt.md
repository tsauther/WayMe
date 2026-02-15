# WayMe Project Prompt

## Overview

A single page application that tracks weight over time. Differentiated by ease of use and a singular purpose to track weight and display the results. Targeted towards Android and completely disconnected from needing the Internet. Purpose is to motivate the user to stay consistent with weighing in.

## Technology
Uses modern web languages, including a Service Worker that allows the building of a PWA for local installation of the page with no backend server requirments (page is self-contained on the phone).

## Features
1. Modern look and feel using mobile specific look and feel.
2. Installable as a PWA.  If installed, no prompt is available until uninstalled.
3. Data stored locally.
4. Tracks weight in lbs or kg.
4.a. Weight entry screen should be robust and graphical.  An image of a digital scale weight window, with the last logged weight displayed.  When a new weight is entered, the digital representation of the numbers animates to the newly entered number.
5. Suggests daily calorie limits based on a setting of Number of pounds loss desired per week.
5.a. Daily calorie limit is calculated with each weigh in.  If weight lost, daily calorie limit should decrease in order to stay consistent with the pounds per week goal.  Opposite is true if weight is gained.
6. Setting to schedule weigh in frequency, day and time.
6.a. This setting is used to set a scheduled notification.  The time of notification is customizable by setting "notify __ hours before weigh in time."
7. Data represented in tabular and line graph, but not both at the same time.
8. Graph data is scalable over time.  A selection mechanism is provided to change the time axis of the graph.  For example: last month, last 3 months, last 6 months, etc...
9. Allows a widget for placement on screen that displays current graph, last weigh in date and daily calorie limit, also scalable by time.
9.a.  Widget has at least two themes, dark and light.  If widget technology is too experimental, this should be skipped.  It should be easily removable from the appliction.
10. Can open the app from the widget.
11. Has a splash screen with graphic (placeholder for graphic will be supplied later) that displays for at least 2 seconds.
12. Is titled: "WayMe" but is easy to change.
13. Should focus on most simple use of technology first.  Should be as small and lightweight as possible, and browsable/installable via GitHub Pages.  Should not require a server backend to function 100%.
14. Should include input validation.
15. Should allow for adding missed historical data.
16. Dataset is exportable in JSON format.
18. Service worker should use a Cache‑First strategy.

## Suggested technology stack:
Framework:	Svelte
Storage:	IndexedDB + Dexie.js
Graphing:	uPlot
Styling:	Tailwind CSS or lightweight custom CSS
Miscellaneous:   PWA, Service Worker, Manifest, Cache API
Notifications:	Notification API (local)
Widget:	Web App Widgets API
Build:	Vite
Deployment:	GitHub Pages
