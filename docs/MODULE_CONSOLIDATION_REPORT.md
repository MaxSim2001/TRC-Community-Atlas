# Module consolidation report

Review date: **October 14, 2026**

This report reviews the built-in TRC Community Atlas module catalog by label,
business purpose, editor profile, and expected record scope. It distinguishes
probable duplicates from modules that are merely related. A matching summary is
available directly in **Manage modules**.

Atlas now ships with **177 modules**: 9 core assets, 22 apps and services, and
146 optional structured record types.

## Removed vendor-specific modules

| Removed module | Neutral replacement | Data handling |
| --- | --- | --- |
| Datto Appliance | Backup | Existing records are reclassified under Backup when an older workspace is loaded. |
| Datto Asset | Backup | Existing records are reclassified under Backup when an older workspace is loaded. |

The removal affects the catalog, navigation, and new-record choices. It does
not delete record content, attachments, history, or relationships.

## High-confidence consolidation candidates

These aliases use the same purpose or represent a direct translation,
singular/plural variant, or expanded acronym. Records should be moved to the
preferred module before an alias is retired.

| Keep | Candidate aliases to retire | Rationale |
| --- | --- | --- |
| Documents | Documents (custom type) | The core Documents register already covers the same purpose. |
| Backup | Backup (custom type) | The supplied service module covers the same service. |
| Email | Email (custom type) | The supplied service module covers the same service. |
| Antivirus | Antivirus (custom type) | The supplied service module covers the same service. |
| Printing | Printer; Imprimante | Printing has the richer dedicated editor. |
| SSL Tracker | Ssl | SSL Tracker already provides certificate tracking. |
| Licensing | License | Same licensing register. |
| Virtualization | Virtualisation | Direct translation of the same service. |
| Wireless | Wifi | Same wireless service with a different label. |
| Website | Site Internet | Direct translation of the same Web asset. |
| UPS | UPS (uninterruptible power supply) | Acronym and expanded name for the same equipment. |
| Workstation | Ordinateur; Ordinateurs | Generic workstation in English and French. |
| Server | Serveurs; Servers - Generic | Generic server in singular, plural, and English variants. |
| Switch | Switch réseau | Same generic network switch. |
| Digital Signage | TV Signage | Same digital-signage equipment family. |
| Punch Clock | Time Punch Clocks | Same time-clock equipment. |
| Vm | Ordinateur virtuel; Serveur virtuel | Generic virtual machine labels. |
| Laptop | Portable | Same generic portable workstation. |

This list represents **22 probable duplicate modules** across 18 groups. It is
a recommendation, not an automatic deletion list, because each installation
may already have records that must be reviewed or migrated.

## Related modules that should remain for now

| Family | Modules | Why they are not automatic duplicates |
| --- | --- | --- |
| Backup | Backup, msBackup, Sauvegarde 2BBACK, Serveur Veeam 2BBACK, Serveur Linux 2BBACK | A service, software product, and dedicated backup server can be separate records. |
| Network perimeter | Firewall, Pare-feu et Routeur, Router / Firewall, WatchGuard Firebox, Switch/Router | Combined appliances, generic roles, and product-specific devices may require different fields or workflows. |
| Storage | NAS, SAN, SAN/NAS, Storage, Unité de stockage, QNAP | Technology type, physical equipment, and vendor-specific appliance are not always interchangeable. |
| Specialized servers | Managed Server, Servers - Windows, Windows Server, Servers - ESXi, Servers - Proxmox, Serveur physique | Platform-specific operations can justify separate registers. |
| Telephony | Voice/PBX, PBX IP, Phone System, VOIP Phone, Telephone, ATA | The telephony service and its physical endpoints are different assets. |
| Wireless infrastructure | Wireless, Access Point, FortiAP, Wireless Controler, Wireless Router, Wifi Booster, Point-to-Point AP | The service, controller, access point, router, extender, and bridge have distinct operational roles. |

## Recommended cleanup process

1. Export the documentation or create an encrypted full backup.
2. Review record counts for each candidate alias in **Manage modules**.
3. Choose the preferred module and copy or import the alias records into it.
4. Validate attachments, relationships, owners, and review dates.
5. Hide the alias for one review cycle before removing its definition.
6. Keep the related-but-distinct families until their real data and workflows
   prove that they are interchangeable.

The analysis intentionally does not treat a shared editor schema as proof that
two modules are duplicates. Many different IT assets use the same field layout
while representing different operational objects.
