const groups = [
  {
    name: "testgroup",
    label: "First Test Group",
    userIds: [
      "demoUser"
    ],
  },
  {
    name: "dev",
    label: "Developer",
    userIds: ["developer1"],
    unmask: {
      outgoing: {
        '*': true,
      },
      /*
      incoming: {
        '*': true,
      },
      */
    },
  },
  {
    name: "admin",
    label: 'Admin',
    userIds: [
        "demoUser",
    ],
  },
  {
    name: "account",
    label: 'User Account',
    userIds: [
        'mark.hampton@ieee.org', 
    ],
  },
  {
    name: "sysadmin",
    label: 'System Admin',
    userIds: [
      "demoUser", 
    ],
  },
];
export { groups };