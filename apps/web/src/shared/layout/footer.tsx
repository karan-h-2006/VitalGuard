export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs leading-relaxed text-slate-600 lg:whitespace-nowrap">
      © {year} Team 27 (DM Vikas, Karan H, Rohan G), NITK Surathkal. Developed
      for the Software Engineering course.
    </footer>
  );
}
