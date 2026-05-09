interface NavItem {
  title: string;
  href: string;
  description: string;
}

const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Main dashboard with compliance gaps, evidence upload, and assessments",
  },
  {
    title: "Profile",
    href: "/profile",
    description: "User profile and account settings",
  },
];

const MainNavigation = () => {
  return (
    <nav>
      <ul>
        {navigationItems.map((item) => (
          <li key={item.href}>
            <a href={item.href}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MainNavigation;
