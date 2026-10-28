import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { HeroSectionComponent } from '../components/hero-section.component';
import { AboutSectionComponent } from '../components/about-section.component';
import { ServiceSectionComponent } from '../components/service-section.component';
import { ProductSectionComponent } from '../components/product-section.component';
import { DoctorSectionComponent } from '../components/doctor-section.component';
import { BlogSectionComponent } from '../components/blog-section.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';

/**
 * HomePage — chuyển từ React: src/pages/HomePage/HomePage.jsx
 */
@Component({
  selector: 'div[app-home-page]',
  standalone: true,
  imports: [NavBarComponent, HeroSectionComponent, AboutSectionComponent, ServiceSectionComponent, ProductSectionComponent, DoctorSectionComponent, BlogSectionComponent, FooterComponent],
  templateUrl: './home-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
}
