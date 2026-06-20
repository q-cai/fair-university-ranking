from abc import ABC, abstractmethod

class BaseScraper(ABC):
    """Base class for university faculty scrapers."""
    
    def __init__(self, target_url):
        self.target_url = target_url
        self.faculty_data = []
        
    @abstractmethod
    def fetch_page(self):
        """Fetch the HTML or JSON from the target university."""
        pass
        
    @abstractmethod
    def parse_faculty(self, html_content):
        """Parse the content and extract faculty list."""
        pass
        
    @abstractmethod
    def extract_phd_info(self, faculty_profile):
        """Extract the PhD institution from a faculty profile."""
        pass
        
    def run(self):
        """Execute the scraper pipeline."""
        content = self.fetch_page()
        faculty_profiles = self.parse_faculty(content)
        
        for profile in faculty_profiles:
            phd_info = self.extract_phd_info(profile)
            if phd_info:
                self.faculty_data.append({
                    'name': profile.get('name'),
                    'department': profile.get('department'),
                    'phd_institution': phd_info
                })
        
        return self.faculty_data
